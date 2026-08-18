import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ticketNumber } from '../../common/ids';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ── profile ────────────────────────────────────────────────────

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true, role: true, points: true,
        referralCode: true, createdAt: true,
        _count: { select: { orders: true, bookings: true, wishlist: true, referrals: true } },
      },
    });
    if (!user) throw new NotFoundException('Account not found');

    const spent = await this.prisma.order.aggregate({
      where: { userId, paymentStatus: 'PAID' },
      _sum: { total: true },
    });

    const lifetime = spent._sum.total ?? 0;
    return {
      ...user,
      lifetimeValue: lifetime,
      tier: lifetime >= 5000000 ? 'Gold' : lifetime >= 1500000 ? 'Silver' : 'New',
    };
  }

  updateProfile(userId: string, data: { name?: string; email?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: data.name, email: data.email },
      select: { id: true, name: true, email: true },
    });
  }

  // ── addresses ──────────────────────────────────────────────────

  addresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async addAddress(userId: string, data: any) {
    const count = await this.prisma.address.count({ where: { userId } });
    if (data.isDefault || count === 0) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.address.create({
      data: {
        userId,
        label: data.label ?? 'Home',
        name: data.name,
        phone: data.phone,
        line1: data.line1,
        line2: data.line2,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        lat: data.lat,
        lng: data.lng,
        isDefault: data.isDefault ?? count === 0,
      },
    });
  }

  async updateAddress(userId: string, id: string, data: any) {
    const own = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!own) throw new ForbiddenException('That address belongs to another account');

    if (data.isDefault) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.address.update({ where: { id }, data });
  }

  async removeAddress(userId: string, id: string) {
    const own = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!own) throw new ForbiddenException('That address belongs to another account');

    // Addresses attached to an order are history — never delete, just detach from the book.
    const used = await this.prisma.order.count({ where: { addressId: id } });
    if (used > 0) throw new BadRequestException('This address is on a past order and cannot be removed.');

    await this.prisma.address.delete({ where: { id } });
    return { ok: true };
  }

  // ── wishlist ───────────────────────────────────────────────────

  async wishlist(userId: string) {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      include: {
        product: {
          include: {
            category: { select: { name: true, slug: true } },
            variants: { include: { inventory: true }, take: 1 },
          },
        },
      },
    });

    return rows.map((r) => ({
      id: r.product.id,
      slug: r.product.slug,
      name: r.product.name,
      category: r.product.category?.name,
      price: r.product.price,
      mrp: r.product.mrp,
      artKind: r.product.artKind,
      artTone: r.product.artTone,
      mukhi: r.product.mukhi,
      badge: r.product.badge,
      rating: Number(r.product.ratingAvg),
      reviewCount: r.product.ratingCount,
      stock: r.product.variants.reduce(
        (s, v) => s + v.inventory.reduce((t, i) => t + (i.onHand - i.reserved), 0), 0),
    }));
  }

  async toggleWishlist(userId: string, productId: string) {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      await this.prisma.wishlistItem.delete({ where: { id: existing.id } });
      return { saved: false };
    }
    await this.prisma.wishlistItem.create({ data: { userId, productId } });
    return { saved: true };
  }

  // ── loyalty & referrals ────────────────────────────────────────

  async points(userId: string) {
    const [user, ledger] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { points: true } }),
      this.prisma.pointsEntry.findMany({
        where: { userId, reason: { not: 'REFERRAL_PENDING' } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const label: Record<string, string> = {
      ORDER_EARN: 'Order reward',
      ORDER_REDEEM: 'Redeemed at checkout',
      REFERRAL_EARNED: 'Referral bonus',
      REVIEW: 'Review published',
    };

    return {
      balance: user?.points ?? 0,
      entries: ledger.map((e) => ({
        id: e.id,
        delta: e.delta,
        reason: label[e.reason] ?? e.reason,
        createdAt: e.createdAt,
      })),
    };
  }

  async referrals(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        referralCode: true,
        referrals: {
          select: { id: true, name: true, createdAt: true, orders: { where: { paymentStatus: 'PAID' }, select: { id: true } } },
        },
      },
    });

    const signedUp = user?.referrals.length ?? 0;
    const converted = user?.referrals.filter((r) => r.orders.length > 0).length ?? 0;
    const earned = await this.prisma.pointsEntry.aggregate({
      where: { userId, reason: 'REFERRAL_EARNED' },
      _sum: { delta: true },
    });

    return {
      code: user?.referralCode,
      link: `${process.env.WEB_URL || 'https://divyaloka.com'}/r/${user?.referralCode}`,
      signedUp,
      converted,
      pointsEarned: earned._sum.delta ?? 0,
    };
  }

  // ── support ────────────────────────────────────────────────────

  tickets(userId: string) {
    return this.prisma.ticket.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  }

  createTicket(userId: string, data: { subject: string; category: string; body: string }) {
    return this.prisma.ticket.create({
      data: {
        userId,
        number: ticketNumber(),
        subject: data.subject,
        category: data.category,
        body: data.body,
        messages: [{ from: 'customer', body: data.body, at: new Date().toISOString() }] as any,
      },
    });
  }

  notifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, channel: 'inapp' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async markNotificationsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
