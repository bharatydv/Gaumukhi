import type { Metadata } from "next";
import { About } from "../../components/booking";

export const metadata: Metadata = {
  title: "Our story — three generations in Kashi",
  description: "Divyaloka began in 1974 as a single counter near Dashashwamedh Ghat. One rule since: never sell what you cannot prove.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() { return <About />; }
