import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CouponsService } from '../coupons/coupons.service';

const FREE_SHIPPING = Number(process.env.FREE_SHIPPING_THRESHOLD || 299900);
const FLAT_SHIPPING = Number(process.env.SHIPPING_FLAT_FEE || 9900);
const GIFT_WRAP = Number(process.env.GIFT_WRAP_FEE || 14900);

export interface CartTotals {
  subtotal: number;
  discount: number;
  giftWrapFee: number;
  shippingFee: number;
  tax: number;
  total: number;
  freeShippingGap: number;
}

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService, private coupons: CouponsService) {}

  /** One cart per user, or per anonymous session cookie. Merged on login. */
  async resolve(userId?: string, sessionId?: string) {
    if (!userId && !sessionId) throw new BadRequestException('No cart session');

    let cart = userId
      ? await this.prisma.cart.findUnique({ where: { userId } })
      : await this.prisma.cart.findUnique({ where: { sessionId } });

    if (!cart) {
      cart = await this.prisma.cart.create({ data: userId ? { userId } : { sessionId } });
    }
    return cart;
  }

  async mergeOnLogin(userId: string, sessionId: string) {
    const anon = await this.prisma.cart.findUnique({ where: { sessionId }, include: { items: true } });
    if (!anon?.items.length) return;

    const mine = await this.resolve(userId);
    for (const item of anon.items) {
      await this.prisma.cartItem.upsert({
        where: {
          cartId_productId_variantId: { cartId: mine.id, productId: item.productId, variantId: item.variantId },
        },
        create: { cartId: mine.id, productId: item.productId, variantId: item.variantId, qty: item.qty },
        update: { qty: { increment: item.qty } },
      });
    }
    await this.prisma.cart.delete({ where: { id: anon.id } });
  }

  async get(userId?: string, sessionId?: string) {
    const cart = await this.resolve(userId, sessionId);
    const full = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        coupon: true,
        items: {
          include: {
            product: { include: { category: { select: { name: true } } } },
            variant: { include: { inventory: true } },
          },
          orderBy: { addedAt: 'asc' },
        },
      },
    });

    const lines = full.items.map((i) => {
      const unitPrice = i.product.price + (i.variant?.priceDelta ?? 0);
      const stock = (i.variant?.inventory ?? []).reduce((s, inv) => s + (inv.onHand - inv.reserved), 0);
      return {
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        slug: i.product.slug,
        name: i.product.name,
        category: i.product.category?.name,
        artKind: i.product.artKind,
        artTone: i.product.artTone,
        mukhi: i.product.mukhi,
        unitPrice,
        mrp: i.product.mrp,
        qty: i.qty,
        lineTotal: unitPrice * i.qty,
        gstRate: Number(i.product.gstRate),
        stock,
        inStock: stock >= i.qty,
      };
    });

    const totals = this.computeTotals(lines, full.giftWrap, full.coupon?.code ? await this.safeDiscount(full.couponId, lines) : 0);

    return { id: full.id, items: lines, coupon: full.coupon?.code ?? null, giftWrap: full.giftWrap, totals };
  }

  private async safeDiscount(couponId: string, lines: { lineTotal: number }[]) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) return 0;
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    try {
      const r = await this.coupons.evaluate(coupon.code, subtotal);
      return r.discount;
    } catch {
      return 0; // coupon went stale — silently drop rather than blocking the cart
    }
  }

  computeTotals(lines: { lineTotal: number; gstRate: number }[], giftWrap: boolean, discount: number): CartTotals {
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const giftWrapFee = giftWrap ? GIFT_WRAP : 0;
    const shippingFee = subtotal === 0 || subtotal >= FREE_SHIPPING ? 0 : FLAT_SHIPPING;

    // GST is inclusive in listed prices; we surface the component for the invoice.
    const taxable = Math.max(0, subtotal - discount);
    const tax = lines.reduce((s, l) => {
      const share = subtotal ? (l.lineTotal / subtotal) * taxable : 0;
      return s + Math.round(share - share / (1 + l.gstRate / 100));
    }, 0);

    return {
      subtotal,
      discount,
      giftWrapFee,
      shippingFee,
      tax,
      total: taxable + giftWrapFee + shippingFee,
      freeShippingGap: Math.max(0, FREE_SHIPPING - subtotal),
    };
  }

  async addItem(productId: string, variantId: string | null, qty: number, userId?: string, sessionId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: { include: { inventory: true }, orderBy: { isDefault: 'desc' } } },
    });
    if (!product || product.status !== 'ACTIVE') throw new NotFoundException('That product is not available');

    const variant = variantId ? product.variants.find((v) => v.id === variantId) : product.variants[0];
    if (!variant) throw new BadRequestException('Choose a variant first');

    const available = variant.inventory.reduce((s, i) => s + (i.onHand - i.reserved), 0);
    if (available < qty) throw new BadRequestException(`Only ${available} left in stock`);

    const cart = await this.resolve(userId, sessionId);
    await this.prisma.cartItem.upsert({
      where: { cartId_productId_variantId: { cartId: cart.id, productId, variantId: variant.id } },
      create: { cartId: cart.id, productId, variantId: variant.id, qty },
      update: { qty: { increment: qty } },
    });

    return this.get(userId, sessionId);
  }

  async setQty(itemId: string, qty: number, userId?: string, sessionId?: string) {
    const cart = await this.resolve(userId, sessionId);
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException('That item is no longer in your bag');

    if (qty <= 0) await this.prisma.cartItem.delete({ where: { id: itemId } });
    else await this.prisma.cartItem.update({ where: { id: itemId }, data: { qty } });

    return this.get(userId, sessionId);
  }

  async applyCoupon(code: string, userId?: string, sessionId?: string) {
    const cart = await this.get(userId, sessionId);
    const result = await this.coupons.evaluate(code, cart.totals.subtotal, userId);
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponId: result.couponId } });
    return this.get(userId, sessionId);
  }

  async removeCoupon(userId?: string, sessionId?: string) {
    const cart = await this.resolve(userId, sessionId);
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } });
    return this.get(userId, sessionId);
  }

  async setGiftWrap(on: boolean, userId?: string, sessionId?: string) {
    const cart = await this.resolve(userId, sessionId);
    await this.prisma.cart.update({ where: { id: cart.id }, data: { giftWrap: on } });
    return this.get(userId, sessionId);
  }
}
