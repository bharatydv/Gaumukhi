import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { PujaService } from '../puja/puja.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
    private puja: PujaService,
  ) {}

  /**
   * Creates the provider-side order and returns what the browser SDK needs.
   * The amount always comes from our own records — never from the client.
   */
  async createIntent(params: { orderId?: string; bookingId?: string; provider?: 'razorpay' | 'stripe' }) {
    const { orderId, bookingId } = params;
    const provider = params.provider ?? 'razorpay';

    let amount: number;
    let receipt: string;

    if (orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) throw new BadRequestException('Order not found');
      if (order.paymentStatus === PaymentStatus.PAID) throw new BadRequestException('This order is already paid');
      amount = order.total;
      receipt = order.number;
    } else if (bookingId) {
      const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new BadRequestException('Booking not found');
      if (booking.paymentStatus === PaymentStatus.PAID) throw new BadRequestException('This booking is already paid');
      amount = booking.total;
      receipt = booking.reference;
    } else {
      throw new BadRequestException('Nothing to pay for');
    }

    const providerOrderId = await this.createProviderOrder(provider, amount, receipt);

    const payment = await this.prisma.payment.create({
      data: { orderId, bookingId, provider, providerOrderId, amount, status: PaymentStatus.PENDING },
    });

    return {
      paymentId: payment.id,
      provider,
      providerOrderId,
      amount,
      currency: 'INR',
      keyId: provider === 'razorpay' ? process.env.RAZORPAY_KEY_ID : undefined,
      publishableKey: provider === 'stripe' ? process.env.STRIPE_PUBLISHABLE_KEY : undefined,
    };
  }

  private async createProviderOrder(provider: string, amount: number, receipt: string): Promise<string> {
    if (provider === 'razorpay' && process.env.RAZORPAY_KEY_SECRET && process.env.NODE_ENV === 'production') {
      const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify({ amount, currency: 'INR', receipt }),
      });
      if (!res.ok) throw new BadRequestException('Payment gateway is not responding. Try again.');
      const body = (await res.json()) as any;
      return body.id;
    }
    // Sandbox: deterministic fake id so local flows work end to end.
    return `order_test_${receipt}`;
  }

  /**
   * Razorpay webhook. Two things make this safe:
   *  1. HMAC-SHA256 over the raw body, compared in constant time.
   *  2. Idempotency on the provider event id, so retries are no-ops.
   */
  async handleRazorpayWebhook(rawBody: string, signature: string, parsed: any) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (secret) {
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
      const a = Buffer.from(expected);
      const b = Buffer.from(signature || '');
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    const eventId = parsed.id ?? parsed.payload?.payment?.entity?.id;
    const type = parsed.event as string;

    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: 'razorpay', eventId } },
    });
    if (existing?.processed) return { ok: true, duplicate: true };

    await this.prisma.webhookEvent.upsert({
      where: { provider_eventId: { provider: 'razorpay', eventId } },
      create: { provider: 'razorpay', eventId, type, payload: parsed },
      update: {},
    });

    const entity = parsed.payload?.payment?.entity ?? {};
    const providerOrderId = entity.order_id;
    const payment = await this.prisma.payment.findFirst({ where: { providerOrderId } });

    if (!payment) {
      this.logger.warn(`Webhook for unknown provider order ${providerOrderId}`);
      return { ok: true, unmatched: true };
    }

    if (type === 'payment.captured' || type === 'order.paid') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          providerPaymentId: entity.id,
          method: entity.method,
          rawPayload: parsed,
        },
      });
      if (payment.orderId) await this.orders.markPaid(payment.orderId, payment.id);
      if (payment.bookingId) await this.puja.confirmBooking(payment.bookingId);
    }

    if (type === 'payment.failed') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, rawPayload: parsed },
      });
      if (payment.orderId) await this.orders.releaseReservation(payment.orderId);
      if (payment.bookingId) await this.puja.releaseHold(payment.bookingId);
    }

    await this.prisma.webhookEvent.update({
      where: { provider_eventId: { provider: 'razorpay', eventId } },
      data: { processed: true },
    });

    return { ok: true };
  }

  /**
   * Sandbox-only settlement, so the whole flow can be exercised without a gateway.
   * Refuses to run in production.
   */
  async simulateSuccess(paymentId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Not available in production');
    }
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PAID, providerPaymentId: 'pay_test_' + paymentId.slice(-8), method: 'upi' },
    });
    if (payment.orderId) await this.orders.markPaid(payment.orderId, payment.id);
    if (payment.bookingId) await this.puja.confirmBooking(payment.bookingId);
    return { ok: true, settled: true };
  }
}
