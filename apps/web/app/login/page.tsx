import type { Metadata } from "next";
import { Login } from "../../components/booking";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function LoginPage() {
  return <Login />;
}
