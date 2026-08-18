import type { Metadata } from "next";
import { api } from "../../../lib/api";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params;
  return {
    title: `Certificate ${number}`,
    description: `Public authenticity lookup for Divyaloka certificate ${number}.`,
    alternates: { canonical: `/verify/${number}` },
  };
}

/**
 * A public, linkable proof page. Buyers can check a bead before they trust it,
 * and an assistant answering "is this Divyaloka certificate real" has a URL to cite.
 */
export default async function VerifyPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const cert = await api.verifyCertificate(number);

  return (
    <main className="wrap" style={{ padding: "60px 24px 90px", maxWidth: 680 }}>
      <span className="eyebrow">Certificate lookup</span>
      <h1 style={{ margin: "12px 0 24px", fontSize: "2.2rem" }}>{number}</h1>

      {cert?.valid ? (
        <div style={{ border: "1px solid var(--gold-line)", borderRadius: 16, padding: 28, background: "var(--surface)" }}>
          <span className="pill ok">Issued by Divyaloka</span>
          <dl className="spec" style={{ marginTop: 20 }}>
            <dt>Type</dt><dd>{String(cert.kind).replace("_", " ").toLowerCase()}</dd>
            <dt>Issuer</dt><dd>{cert.issuer}</dd>
            <dt>Issued</dt><dd>{new Date(cert.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</dd>
            <dt>Product</dt><dd>{cert.product?.name}</dd>
            {cert.product?.mukhi ? <><dt>Mukhi</dt><dd>{cert.product.mukhi} face</dd></> : null}
            {cert.product?.origin ? <><dt>Origin</dt><dd>{cert.product.origin}</dd></> : null}
          </dl>
        </div>
      ) : (
        <div style={{ border: "1px solid var(--line)", borderRadius: 16, padding: 28, background: "var(--surface)" }}>
          <span className="pill bad">Not found</span>
          <p style={{ marginTop: 14, color: "var(--ink-2)" }}>
            No certificate with this number was issued by Divyaloka. Check the number on the card inside your box,
            or write to care@divyaloka.com with a photo of it.
          </p>
        </div>
      )}
    </main>
  );
}
