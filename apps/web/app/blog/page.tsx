import type { Metadata } from "next";
import { Blog } from "../../components/booking";
import { api } from "../../lib/api";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Journal — notes on beads, ritual and practice",
  description:
    "Written by our Varanasi sourcing team and two senior pandits. How to read an X-ray report, how to spot a carved Ek Mukhi, choosing a muhurat.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  await api.posts();
  return <Blog />;
}
