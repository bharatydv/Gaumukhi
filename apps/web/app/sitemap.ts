import type { MetadataRoute } from "next";
import { api } from "../lib/api";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://divyaloka.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await api.sitemap();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/puja`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/blog`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/contact`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const products = (data?.products ?? []).map((p: any) => ({
    url: `${SITE}/product/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const categories = (data?.categories ?? []).map(
    (c: any) => ({ url: `${SITE}/shop?cat=${encodeURIComponent(c.slug)}`, changeFrequency: "weekly" as const, priority: 0.7 }),
  );

  const posts = (data?.posts ?? []).map((p: any) => ({
    url: `${SITE}/blog/${p.slug}`,
    lastModified: p.publishedAt ? new Date(p.publishedAt) : undefined,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...products, ...categories, ...posts];
}
