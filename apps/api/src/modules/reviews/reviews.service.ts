import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ModerationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Only people who actually bought the thing can review it, and only once.
   * That constraint is the whole reason the rating is worth anything.
   */
  async create(userId: string, data: { productId?: string; bookingId?: string; rating: number; title?: string; body: string }) {
    if (data.rating < 1 || data.rating > 5) throw new BadRequestException('Rating runs from 1 to 5');

    if (data.productId) {
      const bought = await this.prisma.orderItem.findFirst({
        where: { productId: data.productId, order: { userId, paymentStatus: 'PAID' } },
      });
      if (!bought) throw new ForbiddenException('Reviews are open to verified buyers of this product.');

      const already = await this.prisma.review.findFirst({ where: { userId, productId: data.productId } });
      if (already) throw new BadRequestException('You have already reviewed this product.');
    }

    if (data.bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: data.bookingId, userId, status: 'COMPLETED' },
      });
      if (!booking) throw new ForbiddenException('You can review a puja once it is completed.');
    }

    return this.prisma.review.create({
      data: { ...data, userId, verified: true, status: ModerationStatus.PENDING },
    });
  }

  listForProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId, status: ModerationStatus.APPROVED },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    });
  }

  pending() {
    return this.prisma.review.findMany({
      where: { status: ModerationStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true } }, product: { select: { name: true } } },
    });
  }

  /** Approving recomputes the product's aggregate so the PDP and schema.org data stay true. */
  async moderate(id: string, approve: boolean) {
    const review = await this.prisma.review.update({
      where: { id },
      data: { status: approve ? ModerationStatus.APPROVED : ModerationStatus.REJECTED },
    });

    if (approve && review.productId) {
      const agg = await this.prisma.review.aggregate({
        where: { productId: review.productId, status: ModerationStatus.APPROVED },
        _avg: { rating: true },
        _count: true,
      });
      await this.prisma.product.update({
        where: { id: review.productId },
        data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
      });
    }

    if (approve && review.bookingId) {
      const booking = await this.prisma.booking.findUnique({ where: { id: review.bookingId } });
      if (booking?.panditId) {
        const agg = await this.prisma.review.aggregate({
          where: { booking: { panditId: booking.panditId }, status: ModerationStatus.APPROVED },
          _avg: { rating: true },
          _count: true,
        });
        await this.prisma.pandit.update({
          where: { id: booking.panditId },
          data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
        });
      }
    }

    return review;
  }

  askQuestion(productId: string, body: string, userId?: string) {
    return this.prisma.question.create({ data: { productId, body, userId } });
  }

  answerQuestion(id: string, answer: string, answeredBy: string) {
    return this.prisma.question.update({ where: { id }, data: { answer, answeredBy, published: true } });
  }

  listQuestions(productId: string) {
    return this.prisma.question.findMany({
      where: { productId, published: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
