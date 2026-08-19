import { Home } from "../components/storefront";
import { api } from "../lib/api";
import { normProducts, normTestimonial, normPost } from "../lib/normalise";
import { PRODUCTS, TESTIMONIALS, BLOGS } from "../lib/seed-data";

// Statically rendered, revalidated every minute so merchandising changes land fast.
export const revalidate = 60;

export default async function HomePage() {
  // Fetched server-side and handed down, so the catalogue, testimonials and
  // journal are in the initial HTML instead of arriving after hydration.
  const [catalogue, quotes, posts] = await Promise.all([
    api.products({ sort: "featured", take: 24 }),
    api.testimonials(4),
    api.posts(4),
  ]);
  await api.banners("hero");

  return (
    <Home
      products={catalogue?.items?.length ? normProducts(catalogue.items) : PRODUCTS}
      testimonials={(quotes?.length ? quotes : TESTIMONIALS).map(normTestimonial)}
      posts={(posts?.length ? posts : BLOGS).map(normPost)}
    />
  );
}
