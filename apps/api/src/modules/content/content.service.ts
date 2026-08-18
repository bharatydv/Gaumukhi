import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { slugify } from '../../common/slug';

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  async listPosts(take = 12) {
    const cached = await this.redis.get(`posts:${take}`);
    if (cached) return cached;

    const posts = await this.prisma.post.findMany({
      where: { published: true },
      orderBy: { publishedAt: 'desc' },
      take,
      select: {
        slug: true, title: true, excerpt: true, categoryName: true,
        readMinutes: true, authorName: true, coverKey: true, publishedAt: true,
      },
    });
    await this.redis.set(`posts:${take}`, posts, 300);
    return posts;
  }

  async getPost(slug: string) {
    const post = await this.prisma.post.findFirst({ where: { slug, published: true }, include: { seo: true } });
    if (!post) throw new NotFoundException('That article is not published');
    return post;
  }

  upsertPost(data: any) {
    const payload = { ...data, slug: slugify(data.title) };
    return data.id
      ? this.prisma.post.update({ where: { id: data.id }, data: payload })
      : this.prisma.post.create({ data: payload });
  }

  async getPage(slug: string) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  upsertPage(data: { slug: string; title: string; body: string }) {
    return this.prisma.page.upsert({ where: { slug: data.slug }, create: data, update: data });
  }

  banners(placement?: string) {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        active: true,
        ...(placement ? { placement } : {}),
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  upsertBanner(data: any) {
    return data.id
      ? this.prisma.banner.update({ where: { id: data.id }, data })
      : this.prisma.banner.create({ data });
  }

  homeSections() {
    return this.prisma.homeSection.findMany({ orderBy: { displayOrder: 'asc' } });
  }

  async reorderHome(sections: Array<{ key: string; displayOrder: number; visible: boolean }>) {
    await this.prisma.$transaction(
      sections.map((s) =>
        this.prisma.homeSection.update({
          where: { key: s.key },
          data: { displayOrder: s.displayOrder, visible: s.visible },
        }),
      ),
    );
    return this.homeSections();
  }

  /** Feeds the Next.js sitemap route. */
  async sitemapEntries() {
    const [products, categories, posts] = await Promise.all([
      this.prisma.product.findMany({ where: { status: 'ACTIVE' }, select: { slug: true, updatedAt: true } }),
      this.prisma.category.findMany({ where: { active: true }, select: { slug: true } }),
      this.prisma.post.findMany({ where: { published: true }, select: { slug: true, publishedAt: true } }),
    ]);
    return { products, categories, posts };
  }
}
