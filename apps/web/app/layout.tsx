import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { StoreProvider } from "../components/store";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://divyaloka.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Divyaloka — certified Rudraksha, spiritual jewellery & puja booking",
    template: "%s | Divyaloka",
  },
  description:
    "Every Rudraksha ships with its own X-ray scan and lab report. Shop malas, bracelets and puja essentials, or book a verified pandit online or at home.",
  keywords: ["rudraksha", "certified rudraksha", "puja booking", "pandit online", "spiritual jewellery", "japa mala"],
  alternates: { canonical: "/", languages: { "en-IN": "/", "hi-IN": "/hi" } },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Divyaloka",
    title: "Divyaloka — the bead you wear should be provable",
    description: "X-ray verified Rudraksha, ethically sourced from six Himalayan farms since 1974.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF6EC" },
    { media: "(prefers-color-scheme: dark)", color: "#150D07" },
  ],
  width: "device-width",
  initialScale: 1,
};

const organisationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Divyaloka",
  url: SITE,
  foundingDate: "1974",
  address: {
    "@type": "PostalAddress",
    streetAddress: "D 14/9 Dashashwamedh Road",
    addressLocality: "Varanasi",
    addressRegion: "Uttar Pradesh",
    postalCode: "221001",
    addressCountry: "IN",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+91-98765-43210",
    contactType: "customer service",
    availableLanguage: ["en", "hi", "ta", "mr"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organisationSchema) }}
        />
        <Suspense fallback={null}>
          <StoreProvider>{children}</StoreProvider>
        </Suspense>
      </body>
    </html>
  );
}
