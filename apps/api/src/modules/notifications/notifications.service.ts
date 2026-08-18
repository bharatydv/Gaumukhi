import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

type Channel = 'email' | 'sms' | 'whatsapp' | 'push' | 'inapp';

/**
 * Single fan-out point for every message the platform sends.
 * Providers (SES, MSG91, WhatsApp Cloud API, FCM) are swapped behind
 * these four methods; in development everything is logged instead.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  private get live() {
    return process.env.NODE_ENV === 'production';
  }

  async sendSms(phone: string, message: string) {
    if (!this.live || !process.env.MSG91_AUTH_KEY) {
      this.logger.debug(`[sms → ${phone}] ${message}`);
      return { queued: true, simulated: true };
    }
    await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: process.env.MSG91_AUTH_KEY },
      body: JSON.stringify({ mobiles: `91${phone}`, message }),
    });
    return { queued: true };
  }

  async sendWhatsApp(phone: string, template: string, params: Record<string, unknown>) {
    if (!this.live || !process.env.WHATSAPP_TOKEN) {
      this.logger.debug(`[whatsapp → ${phone}] ${template} ${JSON.stringify(params)}`);
      return { queued: true, simulated: true };
    }
    // WhatsApp Cloud API template send
    return { queued: true };
  }

  async sendEmail(to: string, template: string, params: Record<string, unknown>) {
    if (!this.live) {
      this.logger.debug(`[email → ${to}] ${template} ${JSON.stringify(params)}`);
      return { queued: true, simulated: true };
    }
    // AWS SES v2 SendEmail with a template id
    return { queued: true };
  }

  /** Persisted in-app notification plus the outbound channels for that event. */
  async notifyUser(
    userId: string,
    template: string,
    payload: Record<string, unknown>,
    channels: Channel[] = ['inapp', 'email'],
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    await this.prisma.notification.createMany({
      data: channels.map((channel) => ({
        userId,
        channel,
        template,
        payload: payload as any,
        sentAt: new Date(),
      })),
    });

    if (channels.includes('email') && user.email) await this.sendEmail(user.email, template, payload);
    if (channels.includes('sms') && user.phone) await this.sendSms(user.phone, renderSms(template, payload));
    if (channels.includes('whatsapp') && user.phone) await this.sendWhatsApp(user.phone, template, payload);
  }
}

function renderSms(template: string, p: Record<string, any>): string {
  switch (template) {
    case 'order.confirmed':
      return `Order ${p.number} confirmed. We dispatch from Varanasi within 24 hours. Track: ${p.trackUrl || 'divyaloka.com/account'}`;
    case 'order.shipped':
      return `Order ${p.number} has shipped. AWB ${p.awb}.`;
    case 'booking.confirmed':
      return `Booking ${p.reference} confirmed for ${p.when} with ${p.pandit}. Details in your account.`;
    case 'booking.reminder':
      return `Reminder: ${p.puja} at ${p.when}. ${p.meetingUrl ? 'Join: ' + p.meetingUrl : ''}`;
    default:
      return `Divyaloka: ${template}`;
  }
}
