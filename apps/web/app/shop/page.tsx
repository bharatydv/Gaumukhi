import type { Metadata } from "next";
import { ShopPage } from "../../components/storefront";
import { api } from "../../lib/api";

export const revalidate = 300;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ cat?: string }> }): Promise<Metadata> {
  const { cat } = await searchParams;
  const title = cat ? `${cat} — certified & lab verified` : "Shop the full collection";
  return {
    title,
    description: cat
      ? `${cat} from Divyaloka. Every piece ships with its authenticity certificate and lab report.`
      : "Rudraksha malas, bracelets, gemstone malas, puja essentials and handloom clothing — all X-ray verified.",
    alternates: { canonical: cat ? `/shop?cat=${encodeURIComponent(cat)}` : "/shop" },
  };
}

export default async function Shop({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  await api.products({ category: cat, take: 24 });
  return <ShopPage />;
}
