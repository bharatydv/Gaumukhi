import type { Metadata } from "next";
import { Blog } from "../../components/booking";
import { api } from "../../lib/api";
import { normPost } from "../../lib/normalise";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Journal — notes on beads, ritual and practice",
  description:
    "Written by our Varanasi sourcing team and two senior pandits. How to read an X-ray report, how to spot a carved Ek Mukhi, choosing a muhurat.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  // Fetched here so the articles are server-rendered rather than appearing after hydration.
  const rows = await api.posts(24);
  const posts = (rows ?? []).map(normPost);
  return <Blog posts={posts} />;
}
