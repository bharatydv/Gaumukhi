import type { Metadata } from "next";
import { Checkout } from "../../components/booking";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  return <Checkout />;
}
