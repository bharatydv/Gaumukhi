import type { Metadata } from "next";
import { ProductPage } from "../../../components/storefront";
import { api } from "../../../lib/api";
import { PRODUCTS } from "../../../lib/seed-data";
import { normProduct } from "../../../lib/normalise";

export const revalidate = 600;

/**
 * Pre-build the catalogue when the API is reachable. If it is not — CI without a
 * database, for instance — return nothing and let every product render on demand,
 * rather than stalling the build on a connection that will never answer.
 */
export const dynamicParams = true;

export async function generateStaticParams() {
  const res = await api.products({ take: 60 });
  if (!res?.items?.length) return [];
  return res.items.map((p: any) => ({ slug: p.slug }));
}

async function load(slug: string) {
  const live = await api.product(slug);
  // Live payloads are in paise and use API field names; normalise once, here.
  if (live) return normProduct(live);
  return PRODUCTS.find((p: any) => p.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return { title: "Product not found" };

  const description = (p.seo?.metaDescription || p.description || p.desc || "").slice(0, 155);
  return {
    title: p.seo?.title || `${p.name} — certified & X-ray verified`,
    description,
    alternates: { canonical: `/product/${slug}` },
    openGraph: { title: p.name, description, type: "website" },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return <main className="wrap" style={{ padding: "80px 24px" }}><h1>That piece is no longer listed</h1></main>;

  // Product + Offer + AggregateRating, so rich results and AI assistants have
  // something structured to read rather than scraping the page.
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description || p.desc,
    sku: p.sku || `DV-${p.id}`,
    category: p.category,
    material: p.material,
    brand: { "@type": "Brand", name: "Divyaloka" },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: p.price.toFixed(2),
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "Divyaloka" },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: "0", currency: "INR" },
        deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" } },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
      },
    },
    ...(p.rating
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviewCount ?? p.reviews ?? 1 } }
      : {}),
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Shop", item: "/shop" },
      { "@type": "ListItem", position: 3, name: p.category, item: `/shop?cat=${encodeURIComponent(p.category)}` },
      { "@type": "ListItem", position: 4, name: p.name },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <ProductPage product={p} />
    </>
  );
}
