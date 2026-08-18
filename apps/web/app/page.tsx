import { Home } from "../components/storefront";
import { api } from "../lib/api";

// Statically rendered, revalidated every minute so merchandising changes land fast.
export const revalidate = 60;

export default async function HomePage() {
  // Warms the RSC data cache; the client components fall back to bundled data
  // when the API is not running.
  await Promise.all([api.products({ sort: "featured", take: 8 }), api.banners("hero")]);
  return <Home />;
}
