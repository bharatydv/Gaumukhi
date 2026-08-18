import type { Metadata } from "next";
import { AdminPanel } from "../../components/console";

export const metadata: Metadata = { title: "Admin console", robots: { index: false, follow: false } };

export default function AdminPage() { return <AdminPanel />; }
