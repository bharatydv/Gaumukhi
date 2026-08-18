import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap" style={{ padding: "90px 24px", textAlign: "center", maxWidth: 560 }}>
      <span className="eyebrow">404</span>
      <h1 style={{ margin: "14px 0 12px", fontSize: "2.4rem" }}>This page has moved on</h1>
      <p className="muted" style={{ marginBottom: 26 }}>
        The link may be old, or the piece may have sold out and been archived. The collection is one tap away.
      </p>
      <Link className="btn btn-primary" href="/shop">Browse the store</Link>
    </main>
  );
}
