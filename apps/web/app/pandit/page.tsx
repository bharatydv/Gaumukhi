import type { Metadata } from "next";
import { PanditPanel } from "../../components/booking";

export const metadata: Metadata = { title: "Pandit console", robots: { index: false, follow: false } };

export default function PanditPage() { return <PanditPanel />; }
