import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingStatus, PaymentStatus, SlotStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PujaScheduler {
  private readonly logger = new Logger(PujaScheduler.name);

  constructor(private prisma: PrismaService, private notify: NotificationsService) {}

  /** Slots held for an unpaid booking go back on sale. */
  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredHolds() {
    const expired = await this.prisma.availability.findMany({
      where: { status: SlotStatus.HELD, heldUntil: { lt: new Date() } },
      take: 200,
    });
    if (!expired.length) return;

    for (const slot of expired) {
      await this.prisma.$transaction([
        this.prisma.availability.update({
          where: { id: slot.id },
          data: { status: SlotStatus.OPEN, heldUntil: null, bookingId: null },
        }),
        ...(slot.bookingId
          ? [
              this.prisma.booking.updateMany({
                where: { id: slot.bookingId, paymentStatus: PaymentStatus.PENDING },
                data: { status: BookingStatus.CANCELLED, cancelReason: 'Payment window expired' },
              }),
            ]
          : []),
      ]);
    }
    this.logger.log(`Released ${expired.length} expired slot holds`);
  }

  /** T-48h and T-2h reminders across every channel the user has. */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async sendReminders() {
    const windows: Array<[number, number, string]> = [
      [47.5, 48.5, 'T48'],
      [1.5, 2.5, 'T2'],
    ];

    for (const [lo, hi, tag] of windows) {
      const bookings = await this.prisma.booking.findMany({
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.RESCHEDULED] },
          scheduledAt: {
            gte: new Date(Date.now() + lo * 3_600_000),
            lt: new Date(Date.now() + hi * 3_600_000),
          },
        },
        include: { puja: true, pandit: true },
      });

      for (const b of bookings) {
        await this.notify.notifyUser(
          b.userId,
          'booking.reminder',
          { tag, puja: b.puja.name, when: b.scheduledAt.toISOString(), meetingUrl: b.meetingUrl },
          ['inapp', 'whatsapp', 'sms'],
        );
        if (b.pandit) {
          await this.notify.notifyUser(b.pandit.userId, 'booking.reminder',
            { tag, puja: b.puja.name, when: b.scheduledAt.toISOString() }, ['inapp', 'sms']);
        }
      }
    }
  }

  /** Bookings whose muhurat has passed are closed out so reviews can open. */
  @Cron(CronExpression.EVERY_HOUR)
  async closeCompleted() {
    const { count } = await this.prisma.booking.updateMany({
      where: {
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.RESCHEDULED] },
        paymentStatus: PaymentStatus.PAID,
        scheduledAt: { lt: new Date(Date.now() - 6 * 3_600_000) },
      },
      data: { status: BookingStatus.COMPLETED },
    });
    if (count) this.logger.log(`Marked ${count} bookings completed`);
  }

  /** Carts idle for 60+ minutes trigger the recovery sequence. */
  @Cron(CronExpression.EVERY_HOUR)
  async abandonedCarts() {
    const stale = await this.prisma.cart.findMany({
      where: {
        userId: { not: null },
        updatedAt: { lt: new Date(Date.now() - 3_600_000), gt: new Date(Date.now() - 7_200_000) },
        items: { some: {} },
      },
      include: { items: { include: { product: true } } },
      take: 100,
    });

    for (const cart of stale) {
      await this.notify.notifyUser(
        cart.userId,
        'cart.abandoned',
        { items: cart.items.map((i) => i.product.name), count: cart.items.length },
        ['email', 'whatsapp'],
      );
    }
  }
}
