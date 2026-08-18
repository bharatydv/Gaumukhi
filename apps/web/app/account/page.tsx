import type { Metadata } from "next";
import { Account } from "../../components/booking";

export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };

export default function AccountPage() {
  return <Account />;
}
