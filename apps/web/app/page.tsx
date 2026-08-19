import { Home } from "../components/storefront";
import { api } from "../lib/api";
import { normProducts, normTestimonial, normPost } from "../lib/normalise";

// Prices, stock and merchandising are read per request: an admin edit is live on
// the next page load rather than whenever a cache window happens to lapse.
export const revalidate = 0;

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
      products={normProducts(catalogue?.items ?? [])}
      testimonials={(quotes ?? []).map(normTestimonial)}
      posts={(posts ?? []).map(normPost)}
    />
  );
}
