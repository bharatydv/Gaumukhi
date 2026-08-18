import { Injectable, BadRequestException } from '@nestjs/common';
import { BookingStatus, OrderStatus, PanditStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private notify: NotificationsService) {}

  /** Everything the dashboard needs, in one round trip. */
  async dashboard() {
    const now = new Date();
    const from30 = new Date(now.getTime() - 30 * 86_400_000);
    const from60 = new Date(now.getTime() - 60 * 86_400_000);

    const [revenue30, revenuePrev, orders30, bookings30, lowStock, pendingRefunds, panditApplications, pendingReviews] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: { paymentStatus: PaymentStatus.PAID, placedAt: { gte: from30 } },
          _sum: { total: true }, _count: true, _avg: { total: true },
        }),
        this.prisma.order.aggregate({
          where: { paymentStatus: PaymentStatus.PAID, placedAt: { gte: from60, lt: from30 } },
          _sum: { total: true },
        }),
        this.prisma.order.count({ where: { placedAt: { gte: from30 } } }),
        this.prisma.booking.aggregate({
          where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: from30 } },
          _sum: { total: true }, _count: true,
        }),
        this.prisma.inventory.count({ where: { onHand: { lte: 6 } } }),
        this.prisma.refund.count({ where: { status: PaymentStatus.PENDING } }),
        this.prisma.pandit.count({ where: { status: PanditStatus.PENDING } }),
        this.prisma.review.count({ where: { status: 'PENDING' } }),
      ]);

    const storeRevenue = revenue30._sum.total ?? 0;
    const prevRevenue = revenuePrev._sum.total ?? 0;

    return {
      revenue: {
        store: storeRevenue,
        puja: bookings30._sum.total ?? 0,
        total: storeRevenue + (bookings30._sum.total ?? 0),
        changePct: prevRevenue ? Math.round(((storeRevenue - prevRevenue) / prevRevenue) * 100) : 0,
      },
      orders: { count: orders30, averageValue: Math.round(revenue30._avg.total ?? 0) },
      bookings: { count: bookings30._count },
      attention: {
        lowStock,
        pendingRefunds,
        panditApplications,
        pendingReviews,
        unassignedBookings: await this.prisma.booking.count({
          where: { status: BookingStatus.AWAITING_PANDIT, paymentStatus: PaymentStatus.PAID },
        }),
      },
      revenueSeries: await this.revenueSeries(),
      categoryMix: await this.categoryMix(),
    };
  }

  /** Six months of store vs puja revenue for the area chart. */
  private async revenueSeries() {
    const rows = await this.prisma.$queryRaw<Array<{ month: string; store: bigint; puja: bigint }>>`
      WITH months AS (
        SELECT generate_series(date_trunc('month', now()) - interval '5 months',
                               date_trunc('month', now()), interval '1 month') AS m
      )
      SELECT to_char(m, 'Mon') AS month,
        COALESCE((SELECT SUM(total) FROM "Order"
                  WHERE "paymentStatus" = 'PAID' AND date_trunc('month', "placedAt") = m), 0) AS store,
        COALESCE((SELECT SUM(total) FROM "Booking"
                  WHERE "paymentStatus" = 'PAID' AND date_trunc('month', "createdAt") = m), 0) AS puja
      FROM months ORDER BY m`;

    return rows.map((r) => ({ month: r.month, store: Number(r.store), puja: Number(r.puja) }));
  }

  private async categoryMix() {
    const rows = await this.prisma.$queryRaw<Array<{ name: string; units: bigint }>>`
      SELECT c.name, COALESCE(SUM(oi.qty), 0) AS units
      FROM "Category" c
      LEFT JOIN "Product" p ON p."categoryId" = c.id
      LEFT JOIN "OrderItem" oi ON oi."productId" = p.id
      LEFT JOIN "Order" o ON o.id = oi."orderId" AND o."paymentStatus" = 'PAID'
      GROUP BY c.name ORDER BY units DESC LIMIT 6`;

    const total = rows.reduce((s, r) => s + Number(r.units), 0) || 1;
    return rows.map((r) => ({ name: r.name, units: Number(r.units), pct: Math.round((Number(r.units) / total) * 100) }));
  }

  customers(q?: string) {
    return this.prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, name: true, email: true, phone: true, points: true, blocked: true, createdAt: true,
        _count: { select: { orders: true, bookings: true } },
        orders: { where: { paymentStatus: PaymentStatus.PAID }, select: { total: true } },
      },
    }).then((users) =>
      users.map((u) => ({
        ...u,
        lifetimeValue: u.orders.reduce((s, o) => s + o.total, 0),
        orders: undefined,
      })),
    );
  }

  async blockCustomer(id: string, blocked: boolean) {
    return this.prisma.user.update({ where: { id }, data: { blocked }, select: { id: true, blocked: true } });
  }

  inventory() {
    return this.prisma.inventory.findMany({
      orderBy: { onHand: 'asc' },
      take: 100,
      include: {
        warehouse: { select: { name: true, city: true } },
        variant: { include: { product: { select: { name: true, sku: true, price: true } } } },
      },
    });
  }

  adjustStock(inventoryId: string, onHand: number) {
    if (onHand < 0) throw new BadRequestException('Stock cannot be negative');
    return this.prisma.inventory.update({ where: { id: inventoryId }, data: { onHand } });
  }

  bookings(status?: BookingStatus) {
    return this.prisma.booking.findMany({
      where: status ? { status } : {},
      orderBy: { scheduledAt: 'asc' },
      take: 100,
      include: {
        puja: { select: { name: true } },
        pandit: { select: { displayName: true, city: true } },
        user: { select: { name: true, phone: true } },
        address: true,
      },
    });
  }

  /** Coordinator assigns a pandit to a booking nobody has picked up. */
  async assignPandit(bookingId: string, panditId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new BadRequestException('Booking not found');

    const date = new Date(booking.scheduledAt);
    date.setUTCHours(0, 0, 0, 0);

    const slot = await this.prisma.availability.findUnique({
      where: { panditId_date_slot: { panditId, date, slot: booking.slot } },
    });
    if (!slot || slot.status !== 'OPEN') {
      throw new BadRequestException('That pandit is not free at this muhurat.');
    }

    await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: bookingId },
        data: { panditId, status: BookingStatus.AWAITING_PANDIT },
      }),
      this.prisma.availability.update({
        where: { id: slot.id },
        data: { status: 'HELD', bookingId, heldUntil: new Date(Date.now() + 2 * 3_600_000) },
      }),
    ]);

    const pandit = await this.prisma.pandit.findUnique({ where: { id: panditId } });
    await this.notify.notifyUser(pandit.userId, 'booking.request',
      { reference: booking.reference }, ['inapp', 'sms', 'whatsapp']);

    return { ok: true };
  }

  pandits(status?: PanditStatus) {
    return this.prisma.pandit.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, phone: true } },
        certificates: true,
        _count: { select: { bookings: true } },
      },
    });
  }

  async approvePandit(id: string, approve: boolean) {
    const pandit = await this.prisma.pandit.update({
      where: { id },
      data: { status: approve ? PanditStatus.APPROVED : PanditStatus.SUSPENDED },
    });
    if (approve) {
      await this.prisma.user.update({ where: { id: pandit.userId }, data: { role: 'PANDIT' } });
      await this.notify.notifyUser(pandit.userId, 'pandit.approved', { name: pandit.displayName }, ['inapp', 'email', 'sms']);
    }
    return pandit;
  }

  setCommission(id: string, commissionPct: number) {
    return this.prisma.pandit.update({ where: { id }, data: { commissionPct } });
  }

  auditLog(take = 50) {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take });
  }

  async settings() {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  setSetting(key: string, value: unknown) {
    return this.prisma.setting.upsert({
      where: { key },
      create: { key, value: value as any },
      update: { value: value as any },
    });
  }
}
