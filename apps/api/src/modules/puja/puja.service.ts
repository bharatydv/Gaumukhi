import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { BookingMode, BookingStatus, PaymentStatus, SlotStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { NotificationsService } from '../notifications/notifications.service';
import { bookingReference } from '../../common/ids';
import { CreateBookingDto, AvailabilityQueryDto, RescheduleDto } from './dto';

const HOLD_MINUTES = Number(process.env.SLOT_HOLD_MINUTES || 15);

@Injectable()
export class PujaService {
  constructor(
    private prisma: PrismaService,
    private coupons: CouponsService,
    private notify: NotificationsService,
  ) {}

  listPujas() {
    return this.prisma.puja.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * Pandits available for a given date, optionally filtered by language,
   * city and the specific puja they are certified to perform.
   */
  async findPandits(q: AvailabilityQueryDto) {
    const date = q.date ? new Date(q.date) : null;

    const pandits = await this.prisma.pandit.findMany({
      where: {
        status: 'APPROVED',
        ...(q.language ? { languages: { has: q.language } } : {}),
        ...(q.city ? { city: { equals: q.city, mode: 'insensitive' } } : {}),
        ...(q.pujaId ? { services: { some: { pujaId: q.pujaId } } } : {}),
      },
      include: {
        certificates: { where: { verifiedAt: { not: null } }, select: { title: true, issuer: true } },
        availability: date
          ? { where: { date, status: SlotStatus.OPEN }, orderBy: { slot: 'asc' } }
          : { where: { date: { gte: new Date() }, status: SlotStatus.OPEN }, take: 8, orderBy: { date: 'asc' } },
        _count: { select: { bookings: true } },
      },
      orderBy: [{ ratingAvg: 'desc' }, { experienceYrs: 'desc' }],
    });

    return pandits.map((p) => ({
      id: p.id,
      name: p.displayName,
      city: p.city,
      experienceYrs: p.experienceYrs,
      veda: p.veda,
      languages: p.languages,
      bio: p.bio,
      dakshina: p.dakshina,
      rating: Number(p.ratingAvg),
      reviewCount: p.ratingCount,
      completedPujas: p._count.bookings,
      certificates: p.certificates,
      slots: p.availability.map((a) => a.slot),
    }));
  }

  async quote(pujaId: string, mode: BookingMode, panditId?: string, couponCode?: string, userId?: string) {
    const puja = await this.prisma.puja.findUnique({ where: { id: pujaId } });
    if (!puja) throw new NotFoundException('That puja is not listed');

    const pandit = panditId ? await this.prisma.pandit.findUnique({ where: { id: panditId } }) : null;

    const vidhiFee = puja.baseFee;
    const dakshina = pandit?.dakshina ?? 0;
    const samagriFee = mode === BookingMode.ONLINE ? 0 : puja.samagriFee;
    const gross = vidhiFee + dakshina + samagriFee;

    let discount = 0;
    let couponId: string | null = null;
    if (couponCode) {
      const r = await this.coupons.evaluate(couponCode, vidhiFee, userId, true);
      discount = r.discount;
      couponId = r.couponId;
    }

    return { vidhiFee, dakshina, samagriFee, discount, total: gross - discount, couponId, puja, pandit };
  }

  /**
   * The one place where two customers can genuinely collide.
   *
   * We take a row lock on the availability slot inside a transaction, flip it to
   * HELD, and create the booking as PENDING_PAYMENT. The unique constraint on
   * (panditId, date, slot) plus SELECT ... FOR UPDATE means a second request for
   * the same slot blocks and then finds it taken, rather than double-booking.
   * A sweeper releases holds that never got paid.
   */
  async createBooking(userId: string, dto: CreateBookingDto) {
    const date = new Date(dto.date);
    date.setUTCHours(0, 0, 0, 0);

    if (dto.mode !== BookingMode.ONLINE && !dto.addressId) {
      throw new BadRequestException('An address is needed for a pandit to travel to you.');
    }

    const q = await this.quote(dto.pujaId, dto.mode, dto.panditId, dto.couponCode, userId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.panditId) {
        const locked = await tx.$queryRaw<Array<{ id: string; status: SlotStatus; heldUntil: Date | null }>>`
          SELECT id, status, "heldUntil" FROM "Availability"
          WHERE "panditId" = ${dto.panditId} AND date = ${date}::date AND slot = ${dto.slot}
          FOR UPDATE`;

        const slot = locked[0];
        if (!slot) throw new BadRequestException('That pandit has not opened this slot.');

        const heldByOther = slot.status === SlotStatus.HELD && slot.heldUntil && slot.heldUntil > new Date();
        if (slot.status === SlotStatus.BOOKED || slot.status === SlotStatus.BLOCKED || heldByOther) {
          throw new BadRequestException('That muhurat was just taken. Please pick another time.');
        }

        await tx.availability.update({
          where: { panditId_date_slot: { panditId: dto.panditId, date, slot: dto.slot } },
          data: { status: SlotStatus.HELD, heldUntil: new Date(Date.now() + HOLD_MINUTES * 60_000) },
        });
      }

      const scheduledAt = new Date(`${dto.date}T${dto.slot}:00+05:30`);

      const booking = await tx.booking.create({
        data: {
          reference: bookingReference(),
          userId,
          pujaId: dto.pujaId,
          panditId: dto.panditId ?? null,
          mode: dto.mode,
          scheduledAt,
          slot: dto.slot,
          language: dto.language ?? 'Hindi',
          addressId: dto.addressId ?? null,
          sankalpNotes: dto.sankalpNotes,
          attachments: (dto.attachments ?? []) as any,
          vidhiFee: q.vidhiFee,
          dakshina: q.dakshina,
          samagriFee: q.samagriFee,
          discount: q.discount,
          total: q.total,
          couponId: q.couponId,
          status: BookingStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.PENDING,
        },
        include: { puja: true, pandit: true },
      });

      if (dto.panditId) {
        await tx.availability.update({
          where: { panditId_date_slot: { panditId: dto.panditId, date, slot: dto.slot } },
          data: { bookingId: booking.id },
        });
      }

      return { ...booking, holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000) };
    });
  }

  /** Payment webhook lands here. Only now does the slot become BOOKED. */
  async confirmBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { puja: true, pandit: true, user: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.paymentStatus === PaymentStatus.PAID) return booking;

    const date = new Date(booking.scheduledAt);
    date.setUTCHours(0, 0, 0, 0);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (booking.panditId) {
        await tx.availability.updateMany({
          where: { panditId: booking.panditId, date, slot: booking.slot },
          data: { status: SlotStatus.BOOKED, heldUntil: null },
        });
      }
      if (booking.couponId) {
        await tx.coupon.update({ where: { id: booking.couponId }, data: { usedCount: { increment: 1 } } });
        await tx.couponUsage.create({ data: { couponId: booking.couponId, userId: booking.userId } });
      }
      return tx.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: booking.panditId ? BookingStatus.CONFIRMED : BookingStatus.AWAITING_PANDIT,
          meetingUrl:
            booking.mode !== BookingMode.OFFLINE
              ? `https://meet.divyaloka.com/${booking.reference.toLowerCase()}`
              : null,
        },
        include: { puja: true, pandit: true },
      });
    });

    await this.notify.notifyUser(
      booking.userId,
      'booking.confirmed',
      {
        reference: booking.reference,
        puja: booking.puja.name,
        when: booking.scheduledAt.toISOString(),
        pandit: booking.pandit?.displayName ?? 'to be assigned',
        meetingUrl: updated.meetingUrl,
      },
      ['inapp', 'email', 'sms', 'whatsapp'],
    );

    if (booking.pandit) {
      await this.notify.notifyUser(booking.pandit.userId, 'booking.assigned',
        { reference: booking.reference, puja: booking.puja.name }, ['inapp', 'sms']);
    }

    return updated;
  }

  async releaseHold(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.paymentStatus === PaymentStatus.PAID) return;

    const date = new Date(booking.scheduledAt);
    date.setUTCHours(0, 0, 0, 0);

    await this.prisma.$transaction([
      this.prisma.availability.updateMany({
        where: { bookingId: booking.id },
        data: { status: SlotStatus.OPEN, heldUntil: null, bookingId: null },
      }),
      this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED, cancelReason: 'Payment not completed in time' },
      }),
    ]);
  }

  async listMine(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      orderBy: { scheduledAt: 'desc' },
      include: {
        puja: { select: { name: true, durationMin: true } },
        pandit: { select: { displayName: true, city: true, veda: true } },
        address: true,
      },
    });
  }

  async getByReference(userId: string, reference: string) {
    const b = await this.prisma.booking.findUnique({
      where: { reference },
      include: { puja: true, pandit: true, address: true, payments: true },
    });
    if (!b) throw new NotFoundException('No booking with that reference');
    if (b.userId !== userId) throw new ForbiddenException('That booking belongs to another account');
    return b;
  }

  /** Free up to 48 hours before; after that the pandit has already blocked the day. */
  async reschedule(userId: string, reference: string, dto: RescheduleDto) {
    const booking = await this.getByReference(userId, reference);
    const hoursOut = (new Date(booking.scheduledAt).getTime() - Date.now()) / 3_600_000;
    if (hoursOut < 48) {
      throw new BadRequestException('Rescheduling closes 48 hours before the muhurat. Call the puja desk for help.');
    }

    const newDate = new Date(dto.date);
    newDate.setUTCHours(0, 0, 0, 0);

    return this.prisma.$transaction(async (tx) => {
      if (booking.panditId) {
        const target = await tx.availability.findUnique({
          where: { panditId_date_slot: { panditId: booking.panditId, date: newDate, slot: dto.slot } },
        });
        if (!target || target.status !== SlotStatus.OPEN) {
          throw new BadRequestException('That pandit is not free at the new time.');
        }
        await tx.availability.updateMany({
          where: { bookingId: booking.id },
          data: { status: SlotStatus.OPEN, bookingId: null },
        });
        await tx.availability.update({
          where: { id: target.id },
          data: { status: SlotStatus.BOOKED, bookingId: booking.id },
        });
      }
      return tx.booking.update({
        where: { id: booking.id },
        data: {
          scheduledAt: new Date(`${dto.date}T${dto.slot}:00+05:30`),
          slot: dto.slot,
          status: BookingStatus.RESCHEDULED,
        },
      });
    });
  }

  /** Full refund up to 7 days out, 50% up to 48 hours, nothing after. */
  async cancel(userId: string, reference: string, reason: string) {
    const booking = await this.getByReference(userId, reference);
    const hoursOut = (new Date(booking.scheduledAt).getTime() - Date.now()) / 3_600_000;
    const refundPct = hoursOut >= 168 ? 100 : hoursOut >= 48 ? 50 : 0;

    await this.prisma.$transaction([
      this.prisma.availability.updateMany({
        where: { bookingId: booking.id },
        data: { status: SlotStatus.OPEN, bookingId: null, heldUntil: null },
      }),
      this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED, cancelReason: reason },
      }),
    ]);

    return {
      ok: true,
      refundPct,
      refundAmount: Math.round((booking.total * refundPct) / 100),
      message:
        refundPct === 100
          ? 'Cancelled with a full refund, credited in 5 working days.'
          : refundPct === 50
            ? 'Cancelled. Half the amount is refunded; the pandit had already blocked the day.'
            : 'Cancelled. This close to the muhurat the fee is not refundable.',
    };
  }
}
