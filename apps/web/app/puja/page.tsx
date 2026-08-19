import type { Metadata } from "next";
import { BookPuja } from "../../components/booking";
import { api } from "../../lib/api";
import { normPuja, normPandit } from "../../lib/normalise";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Book a pandit — online, at home, or hybrid",
  description:
    "340 verified pandits across 14 states. Fixed fees, itemised samagri, panchang-checked muhurats. Rudrabhishek, Griha Pravesh, Satyanarayan Katha and more.",
  alternates: { canonical: "/puja" },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I choose between an online, offline and hybrid puja?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Online means the pandit joins by video and you set up at home, with no samagri charge. Offline means the pandit travels to your address and brings everything listed. Hybrid means the pandit performs at a temple while family joins by video, and you get a recording.",
      },
    },
    {
      "@type": "Question",
      name: "Can I reschedule or cancel a puja booking?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Rescheduling is free up to 48 hours before the muhurat. Cancelling more than seven days ahead is a full refund, between seven days and 48 hours is half, and inside 48 hours the fee is not refundable because the pandit has already blocked the day.",
      },
    },
    {
      "@type": "Question",
      name: "Is the pandit's dakshina included in the price?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, and it is itemised separately from the vidhi fee and the samagri kit before you pay. The dakshina goes to the pandit in full; Divyaloka earns on the vidhi fee only.",
      },
    },
  ],
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Puja and havan booking",
  provider: { "@type": "Organization", name: "Divyaloka" },
  areaServed: { "@type": "Country", name: "India" },
  availableChannel: { "@type": "ServiceChannel", serviceUrl: "/puja" },
};

export default async function PujaPage() {
  // Server-rendered and handed down, so the puja list and pandit roster are the
  // published ones in the initial HTML rather than a second fetch after hydration.
  const [pujas, pandits] = await Promise.all([api.pujas(), api.pandits()]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <BookPuja
        initialPujas={(pujas ?? []).map(normPuja)}
        initialPandits={(pandits ?? []).map(normPandit)}
      />
    </>
  );
}
