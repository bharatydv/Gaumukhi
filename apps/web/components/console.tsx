"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Art, ProductArt, I, LotusMark } from "./art";
import { money } from "../lib/format";
import { useShop, Stars } from "./shell";
import { api } from "../lib/api";

const SECTIONS = ["Dashboard", "Orders", "Products", "Categories", "Inventory", "Customers",
  "Coupons", "Puja bookings", "Pandits", "Reviews", "Content", "Settings"];

const rupees = (paise?: number | null) => Math.round((paise ?? 0) / 100);
const pretty = (s?: string) => (s ?? "").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

/**
 * Product editor shape. Create and edit share it so a field can never exist on
 * one path and not the other — an absent key is sent as undefined and blanks
 * the column server-side, which is how descriptions used to get wiped on save.
 */
const blankProduct = (categoryId = "") => ({
  id: undefined as string | undefined,
  name: "", categoryId, price: 0, mrp: 0, stock: 0, gstRate: 3,
  mukhi: 5, artKind: "mala", artTone: "rudraksha",
  description: "", benefits: "", howToWear: "", careNotes: "",
  material: "", origin: "", weightGrams: 0, dimensions: "",
  hsnCode: "", badge: "", status: "ACTIVE", featured: false,
  metaTitle: "", metaDescription: "",
});

const productToForm = (p: any) => ({
  ...blankProduct(),
  id: p.id,
  name: p.name ?? "",
  categoryId: p.categoryId ?? "",
  price: rupees(p.price),
  mrp: rupees(p.mrp),
  stock: p.stock ?? 0,
  gstRate: Number(p.gstRate ?? 3),
  mukhi: p.mukhi ?? 5,
  artKind: p.artKind ?? "bead",
  artTone: p.artTone ?? "rudraksha",
  description: p.description ?? p.desc ?? "",
  benefits: (Array.isArray(p.benefits) ? p.benefits : []).join("\n"),
  howToWear: p.howToWear ?? "",
  careNotes: p.careNotes ?? "",
  material: p.material ?? "",
  origin: p.origin ?? "",
  weightGrams: p.weightGrams ?? 0,
  dimensions: p.dimensions ?? "",
  hsnCode: p.hsnCode ?? "",
  badge: p.badge ?? "",
  status: p.status ?? "ACTIVE",
  featured: !!p.featured,
  metaTitle: p.metaTitle ?? "",
  metaDescription: p.metaDescription ?? "",
});

/** Form values → the API's own units and types. */
const formToProduct = (f: any) => ({
  ...(f.id ? { id: f.id } : {}),
  name: f.name.trim(),
  categoryId: f.categoryId,
  price: Math.round(f.price * 100),
  mrp: Math.round(f.mrp * 100),
  stock: f.stock,
  gstRate: f.gstRate,
  mukhi: f.mukhi || undefined,
  artKind: f.artKind,
  artTone: f.artTone,
  description: f.description,
  benefits: f.benefits.split("\n").map((s: string) => s.trim()).filter(Boolean),
  howToWear: f.howToWear || undefined,
  careNotes: f.careNotes || undefined,
  material: f.material || undefined,
  origin: f.origin || undefined,
  weightGrams: f.weightGrams || undefined,
  dimensions: f.dimensions || undefined,
  hsnCode: f.hsnCode || undefined,
  badge: f.badge || undefined,
  status: f.status,
  featured: f.featured,
  metaTitle: f.metaTitle || undefined,
  metaDescription: f.metaDescription || undefined,
});


/**
 * Product photography, managed where the product is.
 *
 * Uploads go straight to the API and come back as saved rows, so what the admin sees
 * here is what the storefront will serve — there is no local preview pretending a file
 * was stored. A product with no photo is a normal state, not an error: the storefront
 * falls back to its drawn artwork.
 */
function ProductImages({ product, onChange }: { product: any; onChange: () => void }) {
  const S = useShop();
  const [shots, setShots] = useState<any[]>(product.media ?? []);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    const rows = await api.productMedia(product.id);
    setShots(rows ?? []);
    onChange();
  }, [product.id, onChange]);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const res = await api.uploadProductImage(product.id, file, product.name);
      if (!res.ok) { S.toast(res.message!, true); break; }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    await refresh();
    S.toast("Photos uploaded");
  };

  const remove = async (id: string) => {
    setBusy(true);
    const res = await api.deleteProductImage(id);
    setBusy(false);
    if (!res.ok) { S.toast(res.message!, true); return; }
    await refresh();
    S.toast("Photo removed");
  };

  // Position 0 is the image every listing card shows, so promoting one is the whole
  // ordering story most shops need.
  const makePrimary = async (id: string) => {
    setBusy(true);
    const rest = shots.filter((m) => m.id !== id);
    await api.updateProductImage(id, { position: 0 });
    await Promise.all(rest.map((m, i) => api.updateProductImage(m.id, { position: i + 1 })));
    setBusy(false);
    await refresh();
    S.toast("Primary photo set");
  };

  return (
    <>
      <h3 style={{ margin: "18px 0 10px", fontSize: ".95rem" }}>Photos</h3>
      <p className="muted" style={{ fontSize: ".78rem", marginTop: -4, marginBottom: 12 }}>
        JPEG, PNG, WebP or AVIF, up to 5 MB each. The first photo is the one shown on listing
        cards; with none uploaded the storefront draws its own artwork instead.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        {shots.map((m, i) => (
          <div key={m.id} style={{ width: 104 }}>
            <div style={{ position: "relative", width: 104, height: 104, borderRadius: 10, overflow: "hidden", border: "1px solid var(--line)", background: "var(--surface-2)" }}>
              <img src={m.url} alt={m.alt || product.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {i === 0 && (
                <span className="tag gold" style={{ position: "absolute", left: 6, top: 6, fontSize: ".6rem" }}>Primary</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {i > 0 && (
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => makePrimary(m.id)} style={{ flex: 1 }}>
                  Primary
                </button>
              )}
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => remove(m.id)} style={{ flex: 1 }}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {shots.length === 0 && (
          <p className="muted" style={{ fontSize: ".82rem" }}>No photos yet — the drawn artwork is being used.</p>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" multiple
        style={{ display: "none" }} onChange={(e) => pick(e.target.files)} />
      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? "Uploading…" : "Upload photos"}
      </button>
    </>
  );
}

const statusPill = (s: string) =>
  /DELIVERED|PAID|APPROVED|COMPLETED|CONFIRMED|ACTIVE/i.test(s) ? "ok"
    : /CANCEL|REFUND|FAIL|SUSPEND|REJECT|EXPIRED/i.test(s) ? "bad" : "warn";

/**
 * Admin console. Every table reads from the API and every button writes back;
 * when the API is unreachable the page says so rather than showing invented rows.
 */
function AdminPanel() {
  const S = useShop();
  const [tab, setTab] = useState("Dashboard");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [data, setData] = useState<any>({});
  const [editing, setEditing] = useState<any>(null);
  const [couponForm, setCouponForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const fetchers: Record<string, () => Promise<any>> = {
      Dashboard: async () => ({ dashboard: await api.dashboard() }),
      Orders: async () => ({ orders: await api.adminOrders(q ? { q } : {}) }),
      Products: async () => ({ products: await api.adminProducts(q), categories: await api.categories() }),
      Categories: async () => ({ categories: await api.categories() }),
      Inventory: async () => ({ inventory: await api.adminInventory() }),
      Customers: async () => ({ customers: await api.adminCustomers(q) }),
      Coupons: async () => ({ coupons: await api.coupons() }),
      "Puja bookings": async () => ({ bookings: await api.adminBookings(), pandits: await api.adminPandits("APPROVED") }),
      Pandits: async () => ({ pandits: await api.adminPandits() }),
      Reviews: async () => ({ reviews: await api.pendingReviews() }),
      Content: async () => ({ posts: await api.posts(20), banners: await api.banners(), sections: await api.homeSections() }),
      Settings: async () => ({ settings: await api.settings(), audit: await api.auditLog(20) }),
    };

    const res = await fetchers[tab]();
    const empty = Object.values(res).every((v) => v == null || (Array.isArray(v) && v.length === 0));
    const health = await api.health();
    setDenied(!health);
    setData((d: any) => ({ ...d, ...res }));
    setLoading(false);
    return empty;
  }, [tab, q]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<any>, okMessage: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res?.ok === false) { S.toast(res.message, true); return false; }
    S.toast(okMessage);
    load();
    return true;
  };

  const d = data.dashboard;
  const series = (d?.revenueSeries ?? []).map((r: any) => ({ m: r.month, store: rupees(r.store), puja: rupees(r.puja) }));
  const mix = (d?.categoryMix ?? []).map((c: any, i: number) => ({
    ...c, c: ["#B85C10", "#E0801B", "#C9A94E", "#8A7359", "#E3C77E", "#5A4230"][i % 6],
  }));

  return (
    <div className="admin">
      <aside className="aside">
        <div style={{ padding: "0 24px 22px", display: "flex", gap: 10, alignItems: "center" }}>
          <LotusMark size={30} />
          <span>
            <span style={{ fontFamily: "var(--display)", color: "#fff", fontSize: "1.06rem" }}>Divyaloka</span>
            <span style={{ display: "block", fontSize: ".54rem", letterSpacing: ".3em", opacity: .6 }}>ADMIN CONSOLE</span>
          </span>
        </div>
        {SECTIONS.map((s) => (
          <button key={s} className={tab === s ? "on" : ""} onClick={() => { setTab(s); setQ(""); }}>{s}</button>
        ))}
        <button onClick={() => S.go("home")}>← Back to store</button>
      </aside>

      <div style={{ padding: 32, background: "var(--bg)", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, marginBottom: 26, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem" }}>{tab}</h1>
            <p className="muted" style={{ fontSize: ".86rem" }}>
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              {S.user ? ` · signed in as ${S.user.email ?? S.userName} (${pretty(S.user.role)})` : " · not signed in"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {["Orders", "Products", "Customers"].includes(tab) && (
              <input className="inp" style={{ width: 220 }} placeholder="Search…" value={q}
                onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => load()}>Refresh</button>
          </div>
        </div>

        {denied && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, marginBottom: 24 }}>
            <b>Not connected</b>
            <p className="muted" style={{ fontSize: ".88rem", marginTop: 6 }}>
              The API is not reachable, so this console has nothing to show. Start it with <code>make dev</code>, then
              sign in as an admin at <button className="link-more" onClick={() => S.go("login")}>the login page</button>.
            </p>
          </div>
        )}

        {loading && <div className="sk" style={{ height: 220, borderRadius: 14 }} />}

        {!loading && tab === "Dashboard" && d && (
          <>
            <div className="grid g4" style={{ marginBottom: 26 }}>
              {[["Revenue (30d)", money(rupees(d.revenue?.total)), `${d.revenue?.changePct >= 0 ? "+" : ""}${d.revenue?.changePct ?? 0}% vs previous 30 days`],
              ["Orders", d.orders?.count ?? 0, `Avg ${money(rupees(d.orders?.averageValue))}`],
              ["Puja bookings", d.bookings?.count ?? 0, `${money(rupees(d.revenue?.puja))} booked`],
              ["Store revenue", money(rupees(d.revenue?.store)), "excludes puja fees"]].map(([t, v, sub]) => (
                <div key={t as string} className="kpi">
                  <span className="pc-cat">{t}</span><b>{v}</b>
                  <span style={{ fontSize: ".78rem", color: "var(--ink-3)" }}>{sub}</span>
                </div>
              ))}
            </div>

            <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", marginBottom: 26 }}>
              <div className="kpi">
                <h3 style={{ marginBottom: 4 }}>Revenue split</h3>
                <p className="muted" style={{ fontSize: ".8rem", marginBottom: 16 }}>Store vs puja services, last six months</p>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ left: -18, right: 6, top: 6 }}>
                      <defs>
                        <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#E0801B" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#E0801B" stopOpacity={0.04} />
                        </linearGradient>
                        <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#B08D2E" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#B08D2E" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--line-2)" vertical={false} />
                      <XAxis dataKey="m" tick={{ fontSize: 11, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--ink-3)" }} axisLine={false} tickLine={false}
                        tickFormatter={(v: any) => (Number(v) / 100000).toFixed(0) + "L"} />
                      <Tooltip formatter={(v: any) => money(Number(v))}
                        contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }} />
                      <Area type="monotone" dataKey="store" stroke="#E0801B" strokeWidth={2} fill="url(#gs)" name="Store" />
                      <Area type="monotone" dataKey="puja" stroke="#B08D2E" strokeWidth={2} fill="url(#gp)" name="Puja" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="kpi">
                <h3 style={{ marginBottom: 4 }}>Category mix</h3>
                <p className="muted" style={{ fontSize: ".8rem", marginBottom: 8 }}>Share of units sold</p>
                <div style={{ height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={mix} dataKey="pct" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={2} stroke="none">
                        {mix.map((m: any) => <Cell key={m.name} fill={m.c} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => v + "%"}
                        contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "grid", gap: 5, fontSize: ".78rem", marginTop: 8 }}>
                  {mix.map((m: any) => (
                    <div key={m.name} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: m.c }} />
                      <span style={{ flex: 1 }}>{m.name}</span><b>{m.pct}%</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="kpi">
              <h3 style={{ marginBottom: 14 }}>Needs attention</h3>
              <div style={{ display: "grid", gap: 10 }}>
                {[[d.attention?.lowStock, "products below reorder point", "Inventory"],
                [d.attention?.pendingRefunds, "refunds awaiting approval", "Orders"],
                [d.attention?.unassignedBookings, "bookings without a pandit", "Puja bookings"],
                [d.attention?.panditApplications, "pandit applications pending", "Pandits"],
                [d.attention?.pendingReviews, "reviews awaiting moderation", "Reviews"]]
                  .filter(([n]) => Number(n) > 0)
                  .map(([n, label, dest]) => (
                    <button key={label as string} onClick={() => setTab(dest as string)} style={{
                      display: "flex", gap: 12, alignItems: "center", width: "100%", textAlign: "left",
                      padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line-2)",
                    }}>
                      <span className="pill warn">{n as number}</span>
                      <span style={{ flex: 1, fontSize: ".85rem" }}>{label}</span>{I.chev}
                    </button>
                  ))}
                {Object.values(d.attention ?? {}).every((v: any) => !v) && (
                  <p className="muted" style={{ fontSize: ".88rem" }}>Nothing needs you right now.</p>
                )}
              </div>
            </div>
          </>
        )}

        {!loading && tab === "Orders" && (
          <div className="kpi">
            {(data.orders ?? []).length === 0 ? <p className="muted">No orders yet.</p> : (
              <table className="tbl">
                <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {data.orders.map((o: any) => (
                    <tr key={o.id}>
                      <td><b>{o.number}</b></td>
                      <td>{new Date(o.placedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                      <td>{o.user?.name}<br /><span className="muted" style={{ fontSize: ".74rem" }}>{o.address?.city}</span></td>
                      <td>{money(rupees(o.total))}</td>
                      <td><span className={`pill ${statusPill(o.paymentStatus)}`}>{pretty(o.paymentStatus)}</span></td>
                      <td><span className={`pill ${statusPill(o.status)}`}>{pretty(o.status)}</span></td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {o.status === "CONFIRMED" && (
                          <button className="btn btn-ghost btn-sm" disabled={busy}
                            onClick={() => act(() => api.setOrderStatus(o.id, "PACKED"), `${o.number} marked packed`)}>Pack</button>
                        )}
                        {o.status === "PACKED" && (
                          <button className="btn btn-ghost btn-sm" disabled={busy}
                            onClick={() => act(() => api.setOrderStatus(o.id, "SHIPPED"), `${o.number} shipped — AWB generated`)}>Ship</button>
                        )}
                        {o.status === "SHIPPED" && (
                          <button className="btn btn-ghost btn-sm" disabled={busy}
                            onClick={() => act(() => api.setOrderStatus(o.id, "DELIVERED"), `${o.number} marked delivered`)}>Delivered</button>
                        )}
                        {o.status === "RETURN_REQUESTED" && (
                          <button className="btn btn-primary btn-sm" disabled={busy}
                            onClick={() => act(() => api.approveRefund(o.refunds?.[0]?.id ?? o.id), "Refund approved")}>Refund</button>
                        )}
                        {o.shipment?.awb && <span className="muted" style={{ fontSize: ".72rem", marginLeft: 8 }}>{o.shipment.awb}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!loading && tab === "Products" && (
          <div className="kpi">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
              <p className="muted" style={{ fontSize: ".86rem" }}>
                {(data.products ?? []).length} products · {(data.products ?? []).filter((p: any) => p.stock < 6).length} low on stock
              </p>
              <button className="btn btn-primary btn-sm"
                onClick={() => setEditing(blankProduct((data.categories?.[0]?.items?.[0]?.id) ?? ""))}>
                Add product
              </button>
            </div>

            {(data.products ?? []).length === 0 ? <p className="muted">Nothing in the catalogue yet.</p> : (
              <table className="tbl">
                <thead><tr><th></th><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {data.products.map((p: any) => (
                    <tr key={p.id}>
                      <td><span style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", background: "var(--surface-2)", display: "block" }}>
                        <ProductArt src={p.image} alt={p.name} kind={p.artKind} tone={p.artTone} mukhi={p.mukhi} id={`a${p.id}`} />
                      </span></td>
                      <td><b>{p.name}</b></td>
                      <td className="muted">{p.sku}</td>
                      <td>{p.category}</td>
                      <td>{money(rupees(p.price))} <s className="muted" style={{ fontSize: ".76rem" }}>{money(rupees(p.mrp))}</s></td>
                      <td>{p.stock}</td>
                      <td><span className={`pill ${p.status === "ARCHIVED" ? "bad" : p.stock === 0 ? "bad" : p.stock < 6 ? "warn" : "ok"}`}>
                        {p.status === "ARCHIVED" ? "Archived" : p.stock === 0 ? "Sold out" : p.stock < 6 ? "Low" : "Live"}
                      </span></td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => setEditing(productToForm(p))}>Edit</button>{" "}
                        <button className="btn btn-ghost btn-sm" disabled={busy}
                          onClick={() => act(() => api.archiveProduct(p.id), `${p.name} archived`)}>Archive</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!loading && tab === "Categories" && (
          <div className="grid g3">
            {(data.categories ?? []).flatMap((g: any) => g.items.map((c: any) => ({ ...c, group: g.group }))).map((c: any) => (
              <div key={c.id} className="kpi">
                <span className="pc-cat">{c.group}</span>
                <h3 style={{ margin: "5px 0" }}>{c.name}</h3>
                <p className="muted" style={{ fontSize: ".8rem" }}>{c.productCount} products · /shop?cat={c.slug}</p>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }}
                  onClick={() => S.go("shop", { cat: c.name })}>View on site</button>
              </div>
            ))}
          </div>
        )}

        {!loading && tab === "Inventory" && (
          <div className="kpi">
            {(data.inventory ?? []).length === 0 ? <p className="muted">No inventory rows.</p> : (
              <table className="tbl">
                <thead><tr><th>Product</th><th>Warehouse</th><th>On hand</th><th>Reserved</th><th>Reorder at</th><th>Adjust</th></tr></thead>
                <tbody>
                  {data.inventory.map((r: any) => (
                    <tr key={r.id}>
                      <td>{r.variant?.product?.name}<br /><span className="muted" style={{ fontSize: ".74rem" }}>{r.variant?.product?.sku}</span></td>
                      <td>{r.warehouse?.name}</td>
                      <td><b>{r.onHand}</b></td>
                      <td>{r.reserved}</td>
                      <td>{r.reorderPoint}</td>
                      <td>
                        <input className="inp" style={{ width: 90, padding: "6px 10px" }} type="number" defaultValue={r.onHand}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== r.onHand) act(() => api.adjustStock(r.id, v), `Stock set to ${v}`);
                          }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!loading && tab === "Customers" && (
          <div className="kpi">
            {(data.customers ?? []).length === 0 ? <p className="muted">No customers match.</p> : (
              <table className="tbl">
                <thead><tr><th>Customer</th><th>Contact</th><th>Orders</th><th>Bookings</th><th>Lifetime</th><th>Points</th><th></th></tr></thead>
                <tbody>
                  {data.customers.map((c: any) => (
                    <tr key={c.id}>
                      <td><b>{c.name ?? "—"}</b>{c.blocked && <span className="pill bad" style={{ marginLeft: 8 }}>Blocked</span>}</td>
                      <td className="muted" style={{ fontSize: ".8rem" }}>{c.email ?? c.phone}</td>
                      <td>{c._count?.orders ?? 0}</td>
                      <td>{c._count?.bookings ?? 0}</td>
                      <td>{money(rupees(c.lifetimeValue))}</td>
                      <td>{c.points}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" disabled={busy}
                          onClick={() => act(() => api.blockCustomer(c.id, !c.blocked), c.blocked ? "Account unblocked" : "Account blocked")}>
                          {c.blocked ? "Unblock" : "Block"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!loading && tab === "Coupons" && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button className="btn btn-primary btn-sm"
                onClick={() => setCouponForm({
                  code: "", type: "PERCENT", value: 10, minCart: 2000, maxDiscount: 0,
                  usageLimit: 500, perUserLimit: 1, appliesToPuja: false, active: true, expiresAt: "",
                })}>
                Create coupon
              </button>
            </div>
            <div className="kpi">
              {(data.coupons ?? []).length === 0 ? <p className="muted">No coupons yet.</p> : (
                <table className="tbl">
                  <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min cart</th><th>Used</th><th>Expires</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {data.coupons.map((c: any) => (
                      <tr key={c.id}>
                        <td><b style={{ fontFamily: "var(--display)" }}>{c.code}</b></td>
                        <td>{pretty(c.type)}</td>
                        <td>{c.type === "PERCENT" ? `${c.value}%` : money(rupees(c.value))}</td>
                        <td>{c.minCart ? money(rupees(c.minCart)) : "—"}</td>
                        <td>{c.usedCount} / {c.usageLimit ?? "∞"}</td>
                        <td>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No expiry"}</td>
                        <td><span className={`pill ${c.active ? "ok" : "bad"}`}>{c.active ? "Active" : "Paused"}</span></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setCouponForm({
                            id: c.id, code: c.code, type: c.type,
                            // Percent is stored as a plain number; every other type is paise.
                            value: c.type === "PERCENT" ? c.value : rupees(c.value),
                            minCart: rupees(c.minCart), maxDiscount: c.maxDiscount ? rupees(c.maxDiscount) : 0,
                            usageLimit: c.usageLimit ?? 0, perUserLimit: c.perUserLimit ?? 1,
                            appliesToPuja: c.appliesToPuja, active: c.active, usedCount: c.usedCount ?? 0,
                            expiresAt: c.expiresAt ? String(c.expiresAt).slice(0, 10) : "",
                          })}>Edit</button>{" "}
                          <button className="btn btn-ghost btn-sm" disabled={busy}
                            onClick={() => act(() => api.updateCoupon(c.id, { active: !c.active }), c.active ? "Coupon paused" : "Coupon activated")}>
                            {c.active ? "Pause" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {!loading && tab === "Puja bookings" && (
          <div className="kpi">
            {(data.bookings ?? []).length === 0 ? <p className="muted">No bookings yet.</p> : (
              <table className="tbl">
                <thead><tr><th>Ref</th><th>Puja</th><th>When</th><th>Mode</th><th>Pandit</th><th>Amount</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {data.bookings.map((b: any) => (
                    <tr key={b.id}>
                      <td><b>{b.reference}</b></td>
                      <td>{b.puja?.name}</td>
                      <td>{new Date(b.scheduledAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td>{pretty(b.mode)}</td>
                      <td>{b.pandit?.displayName ?? <span className="pill bad">Unassigned</span>}</td>
                      <td>{money(rupees(b.total))}</td>
                      <td><span className={`pill ${statusPill(b.status)}`}>{pretty(b.status)}</span></td>
                      <td>
                        {!b.panditId && (
                          <select className="inp" style={{ width: 170, padding: "6px 10px" }} defaultValue=""
                            onChange={(e) => e.target.value && act(() => api.assignPandit(b.id, e.target.value), "Pandit assigned and notified")}>
                            <option value="">Assign pandit…</option>
                            {(data.pandits ?? []).map((p: any) => (
                              <option key={p.id} value={p.id}>{p.displayName} · {p.city}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!loading && tab === "Pandits" && (
          <div className="kpi">
            {(data.pandits ?? []).length === 0 ? <p className="muted">No pandits registered.</p> : (
              <table className="tbl">
                <thead><tr><th>Pandit</th><th>City</th><th>Experience</th><th>Languages</th><th>Rating</th><th>Dakshina</th><th>Commission</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {data.pandits.map((p: any) => (
                    <tr key={p.id}>
                      <td><b>{p.displayName}</b><br /><span className="muted" style={{ fontSize: ".74rem" }}>{p.veda} · {p._count?.bookings ?? 0} pujas</span></td>
                      <td>{p.city}</td>
                      <td>{p.experienceYrs} yrs</td>
                      <td style={{ fontSize: ".8rem" }}>{(p.languages ?? []).join(", ")}</td>
                      <td>{p.ratingCount > 0 ? <Stars v={Number(p.ratingAvg)} /> : <span className="muted">—</span>}</td>
                      <td>{money(rupees(p.dakshina))}</td>
                      <td>
                        <input className="inp" style={{ width: 70, padding: "6px 10px" }} type="number" defaultValue={Number(p.commissionPct)}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== Number(p.commissionPct)) act(() => api.setCommission(p.id, v), `Commission set to ${v}%`);
                          }} />
                      </td>
                      <td><span className={`pill ${statusPill(p.status)}`}>{pretty(p.status)}</span></td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {p.status === "PENDING" && (
                          <>
                            <button className="btn btn-primary btn-sm" disabled={busy}
                              onClick={() => act(() => api.approvePandit(p.id, true), `${p.displayName} approved`)}>Approve</button>{" "}
                            <button className="btn btn-ghost btn-sm" disabled={busy}
                              onClick={() => act(() => api.approvePandit(p.id, false), "Application rejected")}>Reject</button>
                          </>
                        )}
                        {p.status === "APPROVED" && (
                          <button className="btn btn-ghost btn-sm" disabled={busy}
                            onClick={() => act(() => api.approvePandit(p.id, false), `${p.displayName} suspended`)}>Suspend</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!loading && tab === "Reviews" && (
          <div className="kpi">
            <h3 style={{ marginBottom: 14 }}>Awaiting moderation</h3>
            {(data.reviews ?? []).length === 0 ? <p className="muted">Nothing in the queue.</p> : (
              <div style={{ display: "grid", gap: 16 }}>
                {data.reviews.map((r: any) => (
                  <div key={r.id} style={{ borderBottom: "1px solid var(--line-2)", paddingBottom: 16 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                      <b style={{ fontSize: ".9rem" }}>{r.user?.name ?? "Customer"}</b>
                      <Stars v={r.rating} />
                      <span className="muted" style={{ fontSize: ".76rem" }}>{r.product?.name}</span>
                      <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                        <button className="btn btn-primary btn-sm" disabled={busy}
                          onClick={() => act(() => api.moderateReview(r.id, true), "Review published")}>Approve</button>
                        <button className="btn btn-ghost btn-sm" disabled={busy}
                          onClick={() => act(() => api.moderateReview(r.id, false), "Review rejected")}>Reject</button>
                      </span>
                    </div>
                    <p style={{ color: "var(--ink-2)" }}>{r.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && tab === "Content" && (
          <div className="grid g2">
            <div className="kpi">
              <h3 style={{ marginBottom: 14 }}>Journal posts</h3>
              {(data.posts ?? []).map((p: any) => (
                <div key={p.slug} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--line-2)", alignItems: "center" }}>
                  <span style={{ fontSize: ".88rem" }}>
                    {p.title}<br /><span className="muted" style={{ fontSize: ".74rem" }}>{p.categoryName} · {p.readMinutes} min</span>
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => S.go("blog")}>View</button>
                </div>
              ))}
              {(data.posts ?? []).length === 0 && <p className="muted">No posts published.</p>}
            </div>

            <div className="kpi">
              <h3 style={{ marginBottom: 14 }}>Homepage sections</h3>
              {(data.sections ?? []).map((s: any, i: number) => (
                <div key={s.key} style={{ display: "flex", gap: 12, alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--line-2)" }}>
                  <span className="muted" style={{ fontSize: ".78rem", width: 20 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: ".88rem", textTransform: "capitalize" }}>{s.label}</span>
                  <button className={`pill ${s.visible ? "ok" : "bad"}`} disabled={busy}
                    onClick={() => act(
                      () => api.reorderHome((data.sections ?? []).map((x: any) =>
                        x.key === s.key ? { key: x.key, displayOrder: x.displayOrder, visible: !x.visible }
                          : { key: x.key, displayOrder: x.displayOrder, visible: x.visible })),
                      s.visible ? `${s.label} hidden` : `${s.label} shown`)}>
                    {s.visible ? "Visible" : "Hidden"}
                  </button>
                </div>
              ))}
              {(data.sections ?? []).length === 0 && <p className="muted">No sections configured.</p>}
            </div>

            <div className="kpi">
              <h3 style={{ marginBottom: 14 }}>Banners</h3>
              {(data.banners ?? []).map((b: any) => (
                <div key={b.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--line-2)" }}>
                  <span className="pc-cat">{b.placement}</span>
                  <b style={{ display: "block", fontSize: ".9rem", margin: "4px 0" }}>{b.headline}</b>
                  <span className="muted" style={{ fontSize: ".78rem" }}>{b.subheadline}</span>
                </div>
              ))}
              {(data.banners ?? []).length === 0 && <p className="muted">No banners scheduled.</p>}
            </div>
          </div>
        )}

        {!loading && tab === "Settings" && (
          <div className="grid g2">
            <div className="kpi">
              <h3 style={{ marginBottom: 14 }}>Configuration</h3>
              {Object.entries(data.settings ?? {}).map(([k, v]) => (
                <div key={k} style={{ padding: "10px 0", borderBottom: "1px solid var(--line-2)" }}>
                  <b style={{ textTransform: "capitalize" }}>{k}</b>
                  <pre style={{ fontSize: ".74rem", color: "var(--ink-3)", marginTop: 6, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(v, null, 1)}
                  </pre>
                </div>
              ))}
              {!data.settings && <p className="muted">Settings load once the API is connected.</p>}
            </div>

            <div className="kpi">
              <h3 style={{ marginBottom: 14 }}>Audit log</h3>
              {(data.audit ?? []).map((a: any) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--line-2)", fontSize: ".84rem" }}>
                  <span>{a.action} · {a.entity}</span>
                  <span className="muted" style={{ whiteSpace: "nowrap" }}>
                    {new Date(a.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
              {(data.audit ?? []).length === 0 && <p className="muted">No admin activity recorded yet.</p>}
            </div>
          </div>
        )}
      </div>

      {/* ── product editor ── */}
      {editing && (
        <>
          <div className="scrim" onClick={() => setEditing(null)} />
          <div className="sheet" style={{ padding: 30 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2>{editing.id ? "Edit product" : "Add product"}</h2>
              <button className="icobtn" onClick={() => setEditing(null)} aria-label="Close">{I.x}</button>
            </div>

            <div className="grid g2" style={{ gap: 0, columnGap: 18 }}>
              <label className="field"><span>Product name</span>
                <input className="inp" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
              <label className="field"><span>Category</span>
                <select className="inp" value={editing.categoryId} onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}>
                  {(data.categories ?? []).flatMap((g: any) => g.items).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select></label>
              <label className="field"><span>Selling price (₹)</span>
                <input className="inp" type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: +e.target.value })} /></label>
              <label className="field"><span>MRP (₹)</span>
                <input className="inp" type="number" value={editing.mrp} onChange={(e) => setEditing({ ...editing, mrp: +e.target.value })} /></label>
              <label className="field"><span>Stock</span>
                <input className="inp" type="number" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: +e.target.value })} /></label>
              <label className="field"><span>Mukhi / facets</span>
                <input className="inp" type="number" value={editing.mukhi} onChange={(e) => setEditing({ ...editing, mukhi: +e.target.value })} /></label>
              <label className="field"><span>Rendering</span>
                <select className="inp" value={editing.artKind} onChange={(e) => setEditing({ ...editing, artKind: e.target.value })}>
                  {["mala", "bracelet", "pendant", "bead", "cloth", "yantra", "idol", "incense", "samagri", "book", "gift"].map((k) => <option key={k}>{k}</option>)}
                </select></label>
              <label className="field"><span>Tone</span>
                <select className="inp" value={editing.artTone} onChange={(e) => setEditing({ ...editing, artTone: e.target.value })}>
                  {["rudraksha", "tulsi", "sphatik", "ruby", "emerald", "amethyst", "gold", "saffronCloth", "cream"].map((k) => <option key={k}>{k}</option>)}
                </select></label>
              <label className="field"><span>GST rate (%)</span>
                <input className="inp" type="number" step="0.01" value={editing.gstRate}
                  onChange={(e) => setEditing({ ...editing, gstRate: +e.target.value })} /></label>
              <label className="field"><span>Status</span>
                <select className="inp" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="ACTIVE">Active — live on the site</option>
                  <option value="DRAFT">Draft — hidden</option>
                  <option value="ARCHIVED">Archived</option>
                </select></label>
            </div>

            <label className="field"><span>Description</span>
              <textarea className="inp" rows={3} value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label>

            <label className="field"><span>Benefits — one per line</span>
              <textarea className="inp" rows={3} value={editing.benefits}
                placeholder={"Calms the nervous system\nSupports daily japa practice"}
                onChange={(e) => setEditing({ ...editing, benefits: e.target.value })} /></label>

            <div className="grid g2" style={{ gap: 0, columnGap: 18 }}>
              <label className="field"><span>How to wear</span>
                <textarea className="inp" rows={3} value={editing.howToWear}
                  onChange={(e) => setEditing({ ...editing, howToWear: e.target.value })} /></label>
              <label className="field"><span>Care notes</span>
                <textarea className="inp" rows={3} value={editing.careNotes}
                  onChange={(e) => setEditing({ ...editing, careNotes: e.target.value })} /></label>
            </div>

            <h3 style={{ margin: "18px 0 10px", fontSize: ".95rem" }}>Specifications</h3>
            <div className="grid g2" style={{ gap: 0, columnGap: 18 }}>
              <label className="field"><span>Material</span>
                <input className="inp" value={editing.material}
                  onChange={(e) => setEditing({ ...editing, material: e.target.value })} /></label>
              <label className="field"><span>Origin</span>
                <input className="inp" value={editing.origin}
                  onChange={(e) => setEditing({ ...editing, origin: e.target.value })} /></label>
              <label className="field"><span>Weight (grams)</span>
                <input className="inp" type="number" value={editing.weightGrams}
                  onChange={(e) => setEditing({ ...editing, weightGrams: +e.target.value })} /></label>
              <label className="field"><span>Size / dimensions</span>
                <input className="inp" value={editing.dimensions} placeholder="108 + 1 beads, 8 mm"
                  onChange={(e) => setEditing({ ...editing, dimensions: e.target.value })} /></label>
              <label className="field"><span>HSN code</span>
                <input className="inp" value={editing.hsnCode}
                  onChange={(e) => setEditing({ ...editing, hsnCode: e.target.value })} /></label>
              <label className="field"><span>Badge</span>
                <input className="inp" value={editing.badge} placeholder="Best seller, Rare, New…"
                  onChange={(e) => setEditing({ ...editing, badge: e.target.value })} /></label>
            </div>

            <label className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" checked={editing.featured}
                onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} />
              <span style={{ margin: 0 }}>Feature on the homepage</span>
            </label>

            {editing.id ? (
              <ProductImages product={editing} onChange={load} />
            ) : (
              <>
                <h3 style={{ margin: "18px 0 10px", fontSize: ".95rem" }}>Photos</h3>
                <p className="muted" style={{ fontSize: ".82rem", marginTop: -4 }}>
                  Create the product first, then reopen it to upload photos.
                </p>
              </>
            )}

            <h3 style={{ margin: "18px 0 10px", fontSize: ".95rem" }}>Search listing</h3>
            <div className="grid g2" style={{ gap: 0, columnGap: 18 }}>
              <label className="field"><span>Meta title</span>
                <input className="inp" value={editing.metaTitle} placeholder={editing.name}
                  onChange={(e) => setEditing({ ...editing, metaTitle: e.target.value })} /></label>
              <label className="field"><span>Meta description</span>
                <input className="inp" value={editing.metaDescription}
                  onChange={(e) => setEditing({ ...editing, metaDescription: e.target.value })} /></label>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button className="btn btn-primary" disabled={busy || !editing.name.trim() || !editing.categoryId}
                onClick={async () => {
                  const saved = await act(
                    () => api.saveProduct(formToProduct(editing)),
                    editing.id ? "Product updated" : "Product created and published",
                  );
                  if (saved) setEditing(null);
                }}>
                {busy ? "Saving…" : editing.id ? "Save changes" : "Create product"}
              </button>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── coupon editor ── */}
      {couponForm && (
        <>
          <div className="scrim" onClick={() => setCouponForm(null)} />
          <div className="sheet" style={{ padding: 30, top: "16vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2>{couponForm.id ? "Edit coupon" : "Create coupon"}</h2>
              <button className="icobtn" onClick={() => setCouponForm(null)} aria-label="Close">{I.x}</button>
            </div>

            <div className="grid g2" style={{ gap: 0, columnGap: 18 }}>
              <label className="field"><span>Code</span>
                {/* Once a code is in the wild and redeemed, renaming it would break every copy already shared. */}
                <input className="inp" value={couponForm.code} disabled={couponForm.usedCount > 0}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} /></label>
              <label className="field"><span>Type</span>
                <select className="inp" value={couponForm.type} onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value })}>
                  <option value="PERCENT">Percentage</option>
                  <option value="FLAT">Flat amount</option>
                  <option value="REFERRAL">Referral</option>
                </select></label>
              <label className="field"><span>{couponForm.type === "PERCENT" ? "Percent off" : "Amount off (₹)"}</span>
                <input className="inp" type="number" value={couponForm.value}
                  onChange={(e) => setCouponForm({ ...couponForm, value: +e.target.value })} /></label>
              <label className="field"><span>Minimum cart (₹)</span>
                <input className="inp" type="number" value={couponForm.minCart}
                  onChange={(e) => setCouponForm({ ...couponForm, minCart: +e.target.value })} /></label>
              <label className="field"><span>Max discount (₹) — 0 for no cap</span>
                <input className="inp" type="number" value={couponForm.maxDiscount}
                  onChange={(e) => setCouponForm({ ...couponForm, maxDiscount: +e.target.value })} /></label>
              <label className="field"><span>Usage limit — 0 for unlimited</span>
                <input className="inp" type="number" value={couponForm.usageLimit}
                  onChange={(e) => setCouponForm({ ...couponForm, usageLimit: +e.target.value })} /></label>
              <label className="field"><span>Per-customer limit</span>
                <input className="inp" type="number" min={1} value={couponForm.perUserLimit}
                  onChange={(e) => setCouponForm({ ...couponForm, perUserLimit: +e.target.value })} /></label>
              <label className="field"><span>Expires on — blank for never</span>
                <input className="inp" type="date" value={couponForm.expiresAt}
                  onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })} /></label>
              <label className="field" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 26 }}>
                <input type="checkbox" checked={couponForm.appliesToPuja}
                  onChange={(e) => setCouponForm({ ...couponForm, appliesToPuja: e.target.checked })} />
                <span style={{ margin: 0 }}>Also valid on puja bookings</span>
              </label>
              <label className="field" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 26 }}>
                <input type="checkbox" checked={couponForm.active}
                  onChange={(e) => setCouponForm({ ...couponForm, active: e.target.checked })} />
                <span style={{ margin: 0 }}>Active</span>
              </label>
            </div>

            {couponForm.id && (
              <p className="muted" style={{ fontSize: ".8rem", marginBottom: 14 }}>
                Redeemed {couponForm.usedCount} time{couponForm.usedCount === 1 ? "" : "s"} so far.
                {couponForm.usedCount > 0 && " The code itself is locked because it is already in circulation."}
              </p>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-primary" disabled={busy || !couponForm.code}
                onClick={async () => {
                  // The API stores money as paise and percent as a plain number; convert at this one boundary.
                  const body = {
                    code: couponForm.code,
                    type: couponForm.type,
                    value: couponForm.type === "PERCENT" ? couponForm.value : Math.round(couponForm.value * 100),
                    minCart: Math.round(couponForm.minCart * 100),
                    maxDiscount: couponForm.maxDiscount ? Math.round(couponForm.maxDiscount * 100) : null,
                    usageLimit: couponForm.usageLimit ? couponForm.usageLimit : null,
                    perUserLimit: couponForm.perUserLimit || 1,
                    appliesToPuja: couponForm.appliesToPuja,
                    active: couponForm.active,
                    expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt).toISOString() : null,
                  };
                  const ok = await act(
                    () => (couponForm.id ? api.updateCoupon(couponForm.id, body) : api.createCoupon(body)),
                    couponForm.id ? `${couponForm.code} updated` : `${couponForm.code} created`,
                  );
                  if (ok) setCouponForm(null);
                }}>
                {busy ? "Saving…" : couponForm.id ? "Save changes" : "Create coupon"}
              </button>
              <button className="btn btn-ghost" onClick={() => setCouponForm(null)}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { AdminPanel };
