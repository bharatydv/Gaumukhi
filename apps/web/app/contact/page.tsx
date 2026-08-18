import type { Metadata } from "next";
import { Contact } from "../../components/booking";

export const metadata: Metadata = {
  title: "Contact",
  description: "Advisors answer in Hindi, English, Tamil and Marathi, 9am–9pm IST. Store at D 14/9 Dashashwamedh Road, Varanasi.",
  alternates: { canonical: "/contact" },
};

const localBusiness = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Divyaloka",
  image: "/og.png",
  telephone: "+91-98765-43210",
  email: "care@divyaloka.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "D 14/9 Dashashwamedh Road",
    addressLocality: "Varanasi",
    addressRegion: "UP",
    postalCode: "221001",
    addressCountry: "IN",
  },
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    opens: "09:00",
    closes: "21:00",
  },
};

export default function ContactPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }} />
      <Contact />
    </>
  );
}
