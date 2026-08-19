import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { StorageService, UploadedFile, mediaUrl } from '../../common/storage.service';
import { slugify } from '../../common/slug';
import { certificateNumber } from '../../common/ids';
import { ProductQueryDto, UpsertProductDto, PatchProductDto, UpsertCategoryDto } from './dto';

const LIST_TTL = 120;
const DETAIL_TTL = 300;

@Injectable()
export class CatalogService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private storage: StorageService,
  ) {}

  // ── read ───────────────────────────────────────────────────────

  async listCategories() {
    const cached = await this.redis.get('cat:all');
    if (cached) return cached;

    const rows = await this.prisma.category.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });

    const grouped = rows.reduce<Record<string, any[]>>((acc, c) => {
      (acc[c.groupName] ||= []).push({
        id: c.id, slug: c.slug, name: c.name, productCount: c._count.products, imageKey: c.imageKey,
      });
      return acc;
    }, {});

    const out = Object.entries(grouped).map(([group, items]) => ({ group, items }));
    await this.redis.set('cat:all', out, LIST_TTL);
    return out;
  }

  async listProducts(q: ProductQueryDto) {
    const take = Math.min(Number(q.take) || 24, 60);
    const key = `prod:list:${JSON.stringify({ ...q, take })}`;
    const cached = await this.redis.get(key);
    if (cached) return cached;

    const where: Prisma.ProductWhereInput = { status: ProductStatus.ACTIVE };

    if (q.category) where.category = { slug: q.category };
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
        { material: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    if (q.priceMin != null || q.priceMax != null) {
      where.price = { gte: Number(q.priceMin) || 0, lte: Number(q.priceMax) || 100_000_000 };
    }
    if (q.mukhi) {
      where.mukhi = { in: String(q.mukhi).split(',').map(Number).filter(Boolean) };
    }
    if (q.inStock) {
      where.variants = { some: { inventory: { some: { onHand: { gt: 0 } } } } };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = {
      price_asc: [{ price: 'asc' }],
      price_desc: [{ price: 'desc' }],
      best: [{ soldCount: 'desc' }],
      rating: [{ ratingAvg: 'desc' }],
      new: [{ createdAt: 'desc' }],
      featured: [{ featured: 'desc' }, { soldCount: 'desc' }],
    }[q.sort || 'featured'] as any;

    const items = await this.prisma.product.findMany({
      where,
      orderBy,
      take: take + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: {
        category: { select: { name: true, slug: true } },
        variants: { include: { inventory: true }, take: 1, orderBy: { isDefault: 'desc' } },
        // The card needs the primary photo; the rest are only fetched on the detail page.
        media: { orderBy: { position: 'asc' }, take: 1 },
      },
    });

    const hasMore = items.length > take;
    const page = items.slice(0, take).map(shapeProduct);
    const out = { items: page, nextCursor: hasMore ? page[page.length - 1]?.id : null, count: page.length };

    await this.redis.set(key, out, LIST_TTL);
    return out;
  }

  async getProduct(slug: string) {
    const cached = await this.redis.get(`prod:${slug}`);
    if (cached) return cached;

    const p = await this.prisma.product.findFirst({
      where: { slug, status: { not: ProductStatus.ARCHIVED } },
      include: {
        category: true,
        variants: { include: { inventory: true } },
        media: { orderBy: { position: 'asc' } },
        certificates: true,
        seo: true,
        reviews: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { name: true } } },
        },
      },
    });
    if (!p) throw new NotFoundException('That product is no longer listed');

    const related = await this.prisma.product.findMany({
      where: { categoryId: p.categoryId, id: { not: p.id }, status: ProductStatus.ACTIVE },
      take: 4,
      include: { category: { select: { name: true, slug: true } }, variants: { include: { inventory: true }, take: 1 } },
    });

    const out = {
      ...shapeProduct(p),
      description: p.description,
      benefits: p.benefits,
      howToWear: p.howToWear,
      careNotes: p.careNotes,
      origin: p.origin,
      material: p.material,
      weightGrams: p.weightGrams,
      dimensions: p.dimensions,
      gstRate: Number(p.gstRate),
      variants: p.variants.map((v) => ({
        id: v.id, sku: v.sku, label: v.label, size: v.size, priceDelta: v.priceDelta,
        stock: v.inventory.reduce((s, i) => s + (i.onHand - i.reserved), 0),
      })),
      media: p.media.map((m: any) => ({
        id: m.id, kind: m.kind, url: mediaUrl(m.key), alt: m.alt ?? p.name, position: m.position,
      })),
      certificates: p.certificates,
      seo: p.seo,
      reviews: p.reviews.map((r) => ({
        id: r.id, rating: r.rating, title: r.title, body: r.body,
        verified: r.verified, author: r.user?.name || 'Verified buyer', createdAt: r.createdAt,
      })),
      related: related.map(shapeProduct),
    };

    await this.redis.set(`prod:${slug}`, out, DETAIL_TTL);
    return out;
  }

  /** Full catalogue for the admin grid — includes drafts, archived rows and live stock. */
  async adminList(q?: string) {
    const rows = await this.prisma.product.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        variants: { include: { inventory: true } },
        seo: { select: { title: true, metaDescription: true } },
        media: { orderBy: { position: 'asc' } },
      },
    });

    // The editor round-trips these straight back into upsertProduct, so every
    // writable column has to be here — anything omitted gets blanked on save.
    return rows.map((p) => ({
      ...shapeProduct(p),
      status: p.status,
      categoryId: p.categoryId,
      gstRate: Number(p.gstRate),
      description: p.description,
      benefits: Array.isArray(p.benefits) ? p.benefits : [],
      howToWear: p.howToWear,
      careNotes: p.careNotes,
      material: p.material,
      origin: p.origin,
      weightGrams: p.weightGrams,
      dimensions: p.dimensions,
      hsnCode: p.hsnCode,
      barcode: p.barcode,
      metaTitle: p.seo?.title ?? null,
      metaDescription: p.seo?.metaDescription ?? null,
      inventoryId: p.variants[0]?.inventory[0]?.id ?? null,
      // The whole gallery, so the editor can show, reorder and delete what is already there.
      media: p.media.map((m) => ({
        id: m.id, kind: m.kind, url: mediaUrl(m.key), alt: m.alt ?? p.name, position: m.position,
      })),
    }));
  }

  /** Public certificate lookup — /verify/:number. Gives assistants and buyers something checkable. */
  async verifyCertificate(number: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { number },
      include: { product: { select: { name: true, slug: true, mukhi: true, origin: true } } },
    });
    if (!cert) throw new NotFoundException('No certificate with that number was issued by Divyaloka');
    return {
      number: cert.number,
      kind: cert.kind,
      issuer: cert.issuer,
      issuedAt: cert.issuedAt,
      product: cert.product,
      valid: true,
    };
  }

  // ── write (admin) ──────────────────────────────────────────────

  /* ── product media ─────────────────────────────────────────────
     Images are rows, not filenames baked into the frontend: the admin uploads a
     photo and the storefront shows it on the next request, with no deploy. */

  /** Shapes a Media row for the API — the stored key stays private, the URL is derived. */
  private mediaOut = (m: { id: string; kind: string; key: string; alt: string | null; position: number }) => ({
    id: m.id,
    kind: m.kind,
    url: this.storage.publicUrl(m.key),
    alt: m.alt,
    position: m.position,
  });

  async listMedia(productId: string) {
    const rows = await this.prisma.media.findMany({
      where: { productId },
      orderBy: { position: 'asc' },
    });
    return rows.map(this.mediaOut);
  }

  async addMedia(productId: string, file: UploadedFile, alt?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { slug: true, name: true } });
    if (!product) throw new NotFoundException('No such product');
    if (!file) throw new BadRequestException('No image was uploaded.');

    const { key } = await this.storage.save(file, 'products');
    const last = await this.prisma.media.findFirst({ where: { productId }, orderBy: { position: 'desc' } });

    const row = await this.prisma.media.create({
      data: {
        productId,
        kind: 'image',
        key,
        alt: alt?.trim() || product.name,
        position: (last?.position ?? -1) + 1,
      },
    });

    await this.invalidate(product.slug);
    return this.mediaOut(row);
  }

  async updateMedia(id: string, dto: { alt?: string; position?: number }) {
    const existing = await this.prisma.media.findUnique({
      where: { id },
      include: { product: { select: { slug: true } } },
    });
    if (!existing) throw new NotFoundException('No such image');

    const row = await this.prisma.media.update({
      where: { id },
      data: {
        ...(dto.alt !== undefined ? { alt: dto.alt } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });
    await this.invalidate(existing.product.slug);
    return this.mediaOut(row);
  }

  async removeMedia(id: string) {
    const existing = await this.prisma.media.findUnique({
      where: { id },
      include: { product: { select: { slug: true } } },
    });
    if (!existing) throw new NotFoundException('No such image');

    await this.prisma.media.delete({ where: { id } });
    await this.storage.remove(existing.key);
    await this.invalidate(existing.product.slug);
    return { ok: true };
  }

  /**
   * Writes only the fields present in the payload. Used by every partial edit —
   * a price correction, a stock adjustment, flipping `featured` — none of which
   * should require the caller to round-trip the entire product first.
   */
  async patchProduct(id: string, dto: PatchProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('No such product');

    const data: any = {};
    const copy = [
      'name', 'categoryId', 'description', 'howToWear', 'careNotes', 'mrp', 'price',
      'gstRate', 'mukhi', 'origin', 'material', 'weightGrams', 'dimensions', 'hsnCode',
      'barcode', 'artKind', 'artTone', 'badge', 'status', 'featured',
    ] as const;
    for (const key of copy) if (dto[key] !== undefined) data[key] = dto[key];
    if (dto.benefits !== undefined) data.benefits = dto.benefits as any;
    // The URL follows the name, and only the name — a stock edit must never move the page.
    if (dto.name !== undefined) data.slug = slugify(dto.name);

    const price = data.price ?? existing.price;
    const mrp = data.mrp ?? existing.mrp;
    if (price > mrp) throw new BadRequestException('Selling price cannot exceed the MRP.');

    const product = Object.keys(data).length
      ? await this.prisma.product.update({ where: { id }, data })
      : existing;

    if (dto.stock != null) await this.setStock(product.id, dto.stock);

    if (dto.metaTitle !== undefined || dto.metaDescription !== undefined) {
      await this.prisma.seo.upsert({
        where: { productId: product.id },
        create: {
          productId: product.id,
          title: dto.metaTitle ?? product.name,
          metaDescription: dto.metaDescription ?? product.description.slice(0, 155),
        },
        update: {
          ...(dto.metaTitle !== undefined ? { title: dto.metaTitle } : {}),
          ...(dto.metaDescription !== undefined ? { metaDescription: dto.metaDescription } : {}),
        },
      });
    }

    await this.invalidate(product.slug);
    if (existing.slug !== product.slug) await this.invalidate(existing.slug);
    return product;
  }

  /** Sets the on-hand count of a product's default variant, creating the row if needed. */
  private async setStock(productId: string, onHand: number) {
    const variant = await this.prisma.variant.findFirst({
      where: { productId },
      orderBy: { isDefault: 'desc' },
    });
    if (!variant) return;

    const inv = await this.prisma.inventory.findFirst({ where: { variantId: variant.id } });
    if (inv) {
      await this.prisma.inventory.update({ where: { id: inv.id }, data: { onHand } });
      return;
    }
    const warehouse = await this.prisma.warehouse.findFirst();
    if (warehouse) {
      await this.prisma.inventory.create({
        data: { variantId: variant.id, warehouseId: warehouse.id, onHand },
      });
    }
  }

  async upsertProduct(dto: UpsertProductDto) {
    const slug = slugify(dto.name);
    const data = {
      name: dto.name,
      slug,
      categoryId: dto.categoryId,
      description: dto.description ?? '',
      benefits: (dto.benefits ?? []) as any,
      howToWear: dto.howToWear,
      careNotes: dto.careNotes,
      mrp: dto.mrp,
      price: dto.price,
      gstRate: dto.gstRate ?? 3,
      mukhi: dto.mukhi,
      origin: dto.origin,
      material: dto.material,
      weightGrams: dto.weightGrams,
      dimensions: dto.dimensions,
      hsnCode: dto.hsnCode,
      barcode: dto.barcode,
      artKind: dto.artKind ?? 'bead',
      artTone: dto.artTone ?? 'rudraksha',
      badge: dto.badge,
      status: dto.status ?? ProductStatus.ACTIVE,
      featured: dto.featured ?? false,
    };

    const product = dto.id
      ? await this.prisma.product.update({ where: { id: dto.id }, data })
      : await this.prisma.product.create({
          data: { ...data, sku: 'DV-' + slug.toUpperCase().slice(0, 12) + '-' + Date.now().toString(36).slice(-4) },
        });

    // Every product gets a default variant so cart/inventory logic has one shape to deal with.
    let variant = await this.prisma.variant.findFirst({ where: { productId: product.id, isDefault: true } });
    if (!variant) {
      variant = await this.prisma.variant.create({
        data: { productId: product.id, sku: product.sku + '-D', label: 'Standard', isDefault: true },
      });
      const warehouse = await this.prisma.warehouse.findFirst();
      if (warehouse) {
        await this.prisma.inventory.create({
          data: { variantId: variant.id, warehouseId: warehouse.id, onHand: dto.stock ?? 0 },
        });
      }
    } else if (dto.stock != null) {
      await this.setStock(product.id, dto.stock);
    }

    if (dto.metaTitle || dto.metaDescription) {
      await this.prisma.seo.upsert({
        where: { productId: product.id },
        create: {
          productId: product.id,
          title: dto.metaTitle ?? product.name,
          metaDescription: dto.metaDescription ?? product.description.slice(0, 155),
        },
        update: { title: dto.metaTitle, metaDescription: dto.metaDescription },
      });
    }

    if (!dto.id) {
      await this.prisma.certificate.create({
        data: {
          productId: product.id,
          kind: 'AUTHENTICITY',
          number: certificateNumber('AUTHENTICITY'),
          issuer: 'Divyaloka Sourcing',
        },
      });
    }

    await this.invalidate(product.slug);
    return product;
  }

  async archiveProduct(id: string) {
    const p = await this.prisma.product.update({ where: { id }, data: { status: ProductStatus.ARCHIVED } });
    await this.invalidate(p.slug);
    return { ok: true };
  }

  async upsertCategory(dto: UpsertCategoryDto) {
    const data = { ...dto, slug: slugify(dto.name) };
    const c = dto.id
      ? await this.prisma.category.update({ where: { id: dto.id }, data })
      : await this.prisma.category.create({ data });
    await this.redis.del('cat:*');
    return c;
  }

  /**
   * Drops the cached catalogue. Public because stock is edited from the admin
   * inventory screen too, and a write that skips this leaves the shop advertising
   * a count the warehouse no longer has.
   */
  async invalidate(slug?: string) {
    await this.redis.del('prod:list:*');
    if (slug) await this.redis.del(`prod:${slug}`);
  }
}

function shapeProduct(p: any) {
  const stock = (p.variants ?? []).reduce(
    (s: number, v: any) => s + (v.inventory ?? []).reduce((t: number, i: any) => t + (i.onHand - i.reserved), 0),
    0,
  );
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    category: p.category?.name ?? null,
    categorySlug: p.category?.slug ?? null,
    price: p.price,
    mrp: p.mrp,
    discountPct: p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0,
    mukhi: p.mukhi,
    artKind: p.artKind,
    artTone: p.artTone,
    badge: p.badge,
    featured: p.featured,
    rating: Number(p.ratingAvg ?? 0),
    reviewCount: p.ratingCount ?? 0,
    stock,
    // Null when nothing has been uploaded — the storefront then draws its SVG artwork,
    // so a catalogue mid-photoshoot still looks finished.
    image: p.media?.length ? mediaUrl(p.media[0].key) : null,
    imageAlt: p.media?.length ? p.media[0].alt ?? p.name : null,
  };
}
