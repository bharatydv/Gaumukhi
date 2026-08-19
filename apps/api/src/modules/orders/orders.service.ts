import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CartService } from '../cart/cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CatalogService } from '../catalog/catalog.service';
import { orderNumber, invoiceNumber } from '../../common/ids';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private cart: CartService,
    private coupons: CouponsService,
    private notify: NotificationsService,
    private catalog: CatalogService,
  ) {}

  /**
   * Sellable stock is `onHand - reserved`, so reserving, selling and releasing all
   * change what the shop should be advertising. The cached catalogue has to be dropped
   * with them, or the storefront keeps offering a bead that is already in someone's
   * order — the shape of an oversell.
   */
  private async refreshCatalogue(productIds: string[]) {
    const ids = [...new Set(productIds)].filter(Boolean);
    if (!ids.length) return;
    const rows = await this.prisma.product.findMany({ where: { id: { in: ids } }, select: { slug: true } });
    for (const r of rows) await this.catalog.invalidate(r.slug);
  }

  /**
   * Turns a cart into an order. Stock is *reserved* here, not decremented —
   * it is only deducted when payment succeeds, and released if it does not.
   * The whole thing runs in one transaction so a failure leaves no phantom reservation.
   */
  async create(userId: string, addressId: string, pointsToUse = 0) {
    const cart = await this.cart.get(userId);
    if (!cart.items.length) throw new BadRequestException('Your bag is empty');

    const outOfStock = cart.items.filter((i) => !i.inStock);
    if (outOfStock.length) {
      throw new BadRequestException(`Out of stock: ${outOfStock.map((i) => i.name).join(', ')}`);
    }

    const address = await this.prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!address) throw new BadRequestException('Choose a delivery address');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const points = Math.min(Math.max(0, pointsToUse), user.points, cart.totals.total);

    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          number: orderNumber(),
          userId,
          addressId,
          status: OrderStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.PENDING,
          subtotal: cart.totals.subtotal,
          discount: cart.totals.discount,
          giftWrapFee: cart.totals.giftWrapFee,
          shippingFee: cart.totals.shippingFee,
          tax: cart.totals.tax,
          pointsUsed: points,
          total: cart.totals.total - points,
          couponId: (await tx.cart.findUnique({ where: { id: cart.id } }))?.couponId ?? null,
          items: {
            create: cart.items.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
              nameSnapshot: i.name,
              skuSnapshot: i.slug,
              unitPrice: i.unitPrice,
              qty: i.qty,
              gstRate: new Prisma.Decimal(i.gstRate),
              lineTotal: i.lineTotal,
            })),
          },
        },
        include: { items: true },
      });

      // Reserve inventory line by line.
      for (const line of cart.items) {
        const inv = await tx.inventory.findFirst({ where: { variantId: line.variantId } });
        if (!inv || inv.onHand - inv.reserved < line.qty) {
          throw new BadRequestException(`${line.name} sold out while you were checking out`);
        }
        await tx.inventory.update({ where: { id: inv.id }, data: { reserved: { increment: line.qty } } });
      }

      if (points > 0) {
        await tx.user.update({ where: { id: userId }, data: { points: { decrement: points } } });
        await tx.pointsEntry.create({
          data: { userId, delta: -points, reason: 'ORDER_REDEEM', refId: order.id },
        });
      }

      return order;
    });

    await this.refreshCatalogue(created.items.map((i) => i.productId));
    return created;
  }

  /** Called by the payment webhook once funds are confirmed. Idempotent. */
  async markPaid(orderId: string, paymentId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentStatus === PaymentStatus.PAID) return order;

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const inv = await tx.inventory.findFirst({ where: { variantId: item.variantId } });
        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { onHand: { decrement: item.qty }, reserved: { decrement: item.qty } },
          });
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { soldCount: { increment: item.qty } },
        });
      }

      const seq = await tx.invoice.count();
      await tx.invoice.create({ data: { orderId: order.id, number: invoiceNumber(seq + 1) } });

      // Loyalty: 5% of the paid value back as points.
      const earned = Math.round(order.total * 0.05) / 100;
      if (earned >= 1) {
        await tx.user.update({ where: { id: order.userId }, data: { points: { increment: Math.round(earned) } } });
        await tx.pointsEntry.create({
          data: { userId: order.userId, delta: Math.round(earned), reason: 'ORDER_EARN', refId: order.id },
        });
      }

      if (order.couponId) {
        await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { increment: 1 } } });
        await tx.couponUsage.create({ data: { couponId: order.couponId, userId: order.userId, orderId: order.id } });
      }

      // Empty the cart only now, so a failed payment keeps the bag intact.
      const cart = await tx.cart.findUnique({ where: { userId: order.userId } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.cart.update({ where: { id: cart.id }, data: { couponId: null, giftWrap: false } });
      }

      return tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: PaymentStatus.PAID, status: OrderStatus.CONFIRMED },
      });
    });

    await this.refreshCatalogue(order.items.map((i) => i.productId));

    await this.notify.notifyUser(order.userId, 'order.confirmed', { number: order.number, total: order.total },
      ['inapp', 'email', 'sms', 'whatsapp']);

    return updated;
  }

  /** Payment failed or the hold expired — put the stock back. */
  async releaseReservation(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.paymentStatus === PaymentStatus.PAID) return;

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const inv = await tx.inventory.findFirst({ where: { variantId: item.variantId } });
        if (inv) await tx.inventory.update({ where: { id: inv.id }, data: { reserved: { decrement: item.qty } } });
      }
      if (order.pointsUsed > 0) {
        await tx.user.update({ where: { id: order.userId }, data: { points: { increment: order.pointsUsed } } });
      }
      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } });
    });

    await this.refreshCatalogue(order.items.map((i) => i.productId));
  }

  async listMine(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { placedAt: 'desc' },
      include: {
        items: { include: { product: { select: { slug: true, artKind: true, artTone: true, mukhi: true } } } },
        shipment: true,
        invoice: true,
      },
    });
    return orders.map((o) => ({
      id: o.id, number: o.number, status: o.status, paymentStatus: o.paymentStatus,
      total: o.total, placedAt: o.placedAt, itemCount: o.items.length,
      items: o.items, shipment: o.shipment, invoiceNumber: o.invoice?.number ?? null,
    }));
  }

  async getMine(userId: string, number: string) {
    const order = await this.prisma.order.findUnique({
      where: { number },
      include: { items: true, address: true, shipment: true, invoice: true, refunds: true },
    });
    if (!order) throw new NotFoundException('No order with that number');
    if (order.userId !== userId) throw new ForbiddenException('That order belongs to another account');
    return order;
  }

  /** Timeline shown on the tracking page. */
  async track(number: string) {
    const order = await this.prisma.order.findUnique({ where: { number }, include: { shipment: true } });
    if (!order) throw new NotFoundException('No order with that number');

    const steps = [
      { key: 'PLACED', label: 'Order placed', at: order.placedAt, done: true },
      { key: 'CONFIRMED', label: 'Payment confirmed', at: null, done: order.paymentStatus === 'PAID' },
      { key: 'PACKED', label: 'Packed in Varanasi', at: null, done: ['PACKED', 'SHIPPED', 'DELIVERED'].includes(order.status) },
      { key: 'SHIPPED', label: 'Handed to courier', at: order.shipment?.shippedAt, done: ['SHIPPED', 'DELIVERED'].includes(order.status) },
      { key: 'DELIVERED', label: 'Delivered', at: order.shipment?.deliveredAt, done: order.status === 'DELIVERED' },
    ];
    return { number: order.number, status: order.status, awb: order.shipment?.awb, carrier: order.shipment?.carrier, steps };
  }

  async requestReturn(userId: string, number: string, reason: string) {
    const order = await this.getMine(userId, number);
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Returns open once the order is delivered.');
    }
    const days = (Date.now() - new Date(order.placedAt).getTime()) / 86_400_000;
    if (days > 7) throw new BadRequestException('The 7-day return window has closed for this order.');

    await this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.RETURN_REQUESTED } });
    await this.prisma.refund.create({ data: { orderId: order.id, amount: order.total, reason, status: PaymentStatus.PENDING } });
    return { ok: true, message: 'Return requested. A pickup is scheduled within 48 hours.' };
  }

  // ── ops ────────────────────────────────────────────────────────

  async adminList(status?: OrderStatus, q?: string) {
    return this.prisma.order.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q ? { OR: [{ number: { contains: q, mode: 'insensitive' } }, { user: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
      },
      orderBy: { placedAt: 'desc' },
      take: 100,
      include: { user: { select: { name: true, email: true, phone: true } }, address: true, shipment: true },
    });
  }

  async setStatus(orderId: string, status: OrderStatus) {
    const order = await this.prisma.order.update({ where: { id: orderId }, data: { status } });
    if (status === OrderStatus.SHIPPED) {
      const shipment = await this.prisma.shipment.upsert({
        where: { orderId },
        create: { orderId, awb: 'AWB' + Date.now().toString(36).toUpperCase(), status: 'IN_TRANSIT', shippedAt: new Date() },
        update: { status: 'IN_TRANSIT', shippedAt: new Date() },
      });
      await this.notify.notifyUser(order.userId, 'order.shipped', { number: order.number, awb: shipment.awb },
        ['inapp', 'sms', 'whatsapp']);
    }
    if (status === OrderStatus.DELIVERED) {
      await this.prisma.shipment.updateMany({ where: { orderId }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
    }
    return order;
  }

  async approveRefund(refundId: string, approverId: string, approverRole: Role) {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId }, include: { order: true } });
    if (!refund) throw new NotFoundException('Refund not found');

    // Support agents can only sign off small refunds; anything larger needs a manager.
    if (approverRole === Role.SUPPORT && refund.amount > 500000) {
      throw new ForbiddenException('Refunds above ₹5,000 need a manager to approve.');
    }

    await this.prisma.$transaction([
      this.prisma.refund.update({
        where: { id: refundId },
        data: { status: PaymentStatus.REFUNDED, approvedBy: approverId },
      }),
      this.prisma.order.update({
        where: { id: refund.orderId },
        data: { paymentStatus: PaymentStatus.REFUNDED, status: OrderStatus.RETURNED },
      }),
    ]);

    await this.notify.notifyUser(refund.order.userId, 'refund.approved',
      { number: refund.order.number, amount: refund.amount }, ['inapp', 'email', 'sms']);

    return { ok: true };
  }
}
