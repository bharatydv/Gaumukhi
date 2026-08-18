import { Injectable, BadRequestException } from '@nestjs/common';
import { CouponType } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

export interface CouponResult {
  couponId: string;
  code: string;
  discount: number;
}

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validates a coupon against the cart and the user's own usage history.
   * Returns the discount in paise. Throws with a message meant to be shown as-is.
   */
  async evaluate(code: string, subtotal: number, userId?: string, forPuja = false): Promise<CouponResult> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.toUpperCase().trim() } });

    if (!coupon || !coupon.active) throw new BadRequestException('That code is not valid.');
    if (coupon.startsAt > new Date()) throw new BadRequestException('That code is not active yet.');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new BadRequestException('That code has expired.');
    if (forPuja && !coupon.appliesToPuja) throw new BadRequestException('That code does not apply to puja bookings.');
    if (coupon.minCart && subtotal < coupon.minCart) {
      throw new BadRequestException(`This code needs a cart of at least ₹${(coupon.minCart / 100).toLocaleString('en-IN')}.`);
    }
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('That code has been fully claimed.');
    }

    if (userId) {
      const mine = await this.prisma.couponUsage.count({ where: { couponId: coupon.id, userId } });
      if (mine >= coupon.perUserLimit) throw new BadRequestException('You have already used this code.');
    }

    let discount =
      coupon.type === CouponType.PERCENT ? Math.round((subtotal * coupon.value) / 100) : coupon.value;

    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.min(discount, subtotal);

    return { couponId: coupon.id, code: coupon.code, discount };
  }

  /** Called inside the order/booking transaction, never before payment. */
  async consume(couponId: string, userId: string, orderId?: string) {
    await this.prisma.$transaction([
      this.prisma.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } }),
      this.prisma.couponUsage.create({ data: { couponId, userId, orderId } }),
    ]);
  }

  list() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(data: any) {
    return this.prisma.coupon.create({ data: { ...data, code: String(data.code).toUpperCase() } });
  }

  update(id: string, data: any) {
    return this.prisma.coupon.update({ where: { id }, data });
  }
}
