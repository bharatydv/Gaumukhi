import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, PanditStatus, PayoutStatus, SlotStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PanditService {
  constructor(private prisma: PrismaService, private notify: NotificationsService) {}

  private async requirePandit(userId: string) {
    const pandit = await this.prisma.pandit.findUnique({ where: { userId } });
    if (!pandit) throw new ForbiddenException('This area is for registered pandits');
    if (pandit.status !== PanditStatus.APPROVED) {
      throw new ForbiddenException('Your profile is still under review');
    }
    return pandit;
  }

  async profile(userId: string) {
    const pandit = await this.requirePandit(userId);
    return this.prisma.pandit.findUnique({
      where: { id: pandit.id },
      include: { certificates: true, services: { include: { puja: true } } },
    });
  }

  async updateProfile(userId: string, data: any) {
    const pandit = await this.requirePandit(userId);
    return this.prisma.pandit.update({
      where: { id: pandit.id },
      data: {
        displayName: data.displayName,
        city: data.city,
        bio: data.bio,
        veda: data.veda,
        languages: data.languages,
        dakshina: data.dakshina,
      },
    });
  }

  async setServices(userId: string, pujaIds: string[]) {
    const pandit = await this.requirePandit(userId);
    await this.prisma.panditService.deleteMany({ where: { panditId: pandit.id } });
    await this.prisma.panditService.createMany({
      data: pujaIds.map((pujaId) => ({ panditId: pandit.id, pujaId })),
      skipDuplicates: true,
    });
    return this.profile(userId);
  }

  /** Bulk-open or block slots from the availability calendar. */
  async setAvailability(userId: string, entries: Array<{ date: string; slots: string[]; open: boolean }>) {
    const pandit = await this.requirePandit(userId);

    for (const entry of entries) {
      const date = new Date(entry.date);
      date.setUTCHours(0, 0, 0, 0);

      for (const slot of entry.slots) {
        const existing = await this.prisma.availability.findUnique({
          where: { panditId_date_slot: { panditId: pandit.id, date, slot } },
        });

        if (existing?.status === SlotStatus.BOOKED) continue; // never strand a paid booking

        await this.prisma.availability.upsert({
          where: { panditId_date_slot: { panditId: pandit.id, date, slot } },
          create: { panditId: pandit.id, date, slot, status: entry.open ? SlotStatus.OPEN : SlotStatus.BLOCKED },
          update: { status: entry.open ? SlotStatus.OPEN : SlotStatus.BLOCKED },
        });
      }
    }
    return { ok: true };
  }

  async availability(userId: string, from: string, to: string) {
    const pandit = await this.requirePandit(userId);
    return this.prisma.availability.findMany({
      where: { panditId: pandit.id, date: { gte: new Date(from), lte: new Date(to) } },
      orderBy: [{ date: 'asc' }, { slot: 'asc' }],
    });
  }

  async schedule(userId: string, from?: string, to?: string) {
    const pandit = await this.requirePandit(userId);
    return this.prisma.booking.findMany({
      where: {
        panditId: pandit.id,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.RESCHEDULED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED] },
        ...(from && to ? { scheduledAt: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        puja: { select: { name: true, durationMin: true } },
        user: { select: { name: true, phone: true } },
        address: true,
      },
    });
  }

  /** Bookings the coordinator routed to this pandit, awaiting their yes or no. */
  async requests(userId: string) {
    const pandit = await this.requirePandit(userId);
    return this.prisma.booking.findMany({
      where: { panditId: pandit.id, status: BookingStatus.AWAITING_PANDIT, paymentStatus: 'PAID' },
      include: { puja: true, address: true, user: { select: { name: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async respond(userId: string, bookingId: string, accept: boolean, reason?: string) {
    const pandit = await this.requirePandit(userId);
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { puja: true } });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.panditId !== pandit.id) throw new ForbiddenException('That booking is not assigned to you');

    if (accept) {
      const date = new Date(booking.scheduledAt);
      date.setUTCHours(0, 0, 0, 0);
      await this.prisma.$transaction([
        this.prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.CONFIRMED } }),
        this.prisma.availability.updateMany({
          where: { panditId: pandit.id, date, slot: booking.slot },
          data: { status: SlotStatus.BOOKED, bookingId },
        }),
      ]);
      await this.notify.notifyUser(booking.userId, 'booking.pandit_accepted',
        { reference: booking.reference, pandit: pandit.displayName }, ['inapp', 'sms', 'whatsapp']);
      return { ok: true, status: 'CONFIRMED' };
    }

    // Declined — free the slot and hand the booking back to the coordinator queue.
    await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: bookingId },
        data: { panditId: null, status: BookingStatus.AWAITING_PANDIT, cancelReason: reason },
      }),
      this.prisma.availability.updateMany({
        where: { bookingId },
        data: { status: SlotStatus.OPEN, bookingId: null },
      }),
    ]);
    return { ok: true, status: 'REASSIGNING' };
  }

  /** Earnings net of platform commission, plus payout history. */
  async income(userId: string) {
    const pandit = await this.requirePandit(userId);
    const commission = Number(pandit.commissionPct) / 100;

    const completed = await this.prisma.booking.findMany({
      where: { panditId: pandit.id, status: BookingStatus.COMPLETED, paymentStatus: 'PAID' },
      select: { dakshina: true, scheduledAt: true },
    });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const net = (gross: number) => Math.round(gross * (1 - commission));
    const lifetime = net(completed.reduce((s, b) => s + b.dakshina, 0));
    const thisMonth = net(
      completed.filter((b) => b.scheduledAt >= monthStart).reduce((s, b) => s + b.dakshina, 0),
    );

    const payouts = await this.prisma.payout.findMany({
      where: { panditId: pandit.id },
      orderBy: { createdAt: 'desc' },
    });
    const paid = payouts.filter((p) => p.status === PayoutStatus.PAID).reduce((s, p) => s + p.amount, 0);

    return {
      commissionPct: Number(pandit.commissionPct),
      lifetime,
      thisMonth,
      pendingPayout: lifetime - paid,
      completedCount: completed.length,
      averagePerPuja: completed.length ? Math.round(lifetime / completed.length) : 0,
      payouts,
    };
  }

  async requestPayout(userId: string) {
    const pandit = await this.requirePandit(userId);
    const { pendingPayout } = await this.income(userId);

    if (pendingPayout < 100000) throw new BadRequestException('Payouts start at ₹1,000.');

    const periodEnd = new Date();
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 1);

    return this.prisma.payout.create({
      data: { panditId: pandit.id, amount: pendingPayout, periodStart, periodEnd, status: PayoutStatus.PENDING },
    });
  }
}
