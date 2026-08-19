"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Art, I, LotusMark } from "./art";
import { money, PRODUCTS, PUJAS } from "../lib/seed-data";
import { api } from "../lib/api";
import { normProducts, normPuja } from "../lib/normalise";


/* ============================ STORE ============================ */

const Shop = React.createContext(null);
const useShop = () => React.useContext(Shop) as any;

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); } },
      { threshold: 0.12, rootMargin: "0px 0px -40px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
const Reveal = ({ children, delay = 0, as: Tag = "div", ...rest }: any) => {
  const ref = useReveal();
  const T: any = Tag;
  return <T ref={ref} className={`reveal ${rest.className || ""}`} style={{ transitionDelay: `${delay}ms`, ...rest.style }}>{children}</T>;
};

const Stars = ({ v, n }: { v: any; n?: any }) => (
  <span className="stars">
    {[1, 2, 3, 4, 5].map((i) => <span key={i}>{I.star(i <= Math.round(v))}</span>)}
    {n != null && <span style={{ fontSize: ".72rem", color: "var(--ink-3)", marginLeft: 6 }}>{v} ({n})</span>}
  </span>
);

/* ============================ HEADER ============================ */

function Header() {
  const S = useShop();
  const [stuck, setStuck] = useState(false);
  const [mega, setMega] = useState(false);
  const [mob, setMob] = useState(false);
  useEffect(() => {
    const f = () => setStuck(window.scrollY > 12);
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  const nav: Array<[string, (() => void) | null]> = [
    ["Home", () => S.go("home")],
    ["Shop", () => S.go("shop")],
    ["Categories", null],
    ["Collections", () => S.go("shop", { collection: "Signature" })],
    ["Blogs", () => S.go("blog")],
    ["About Us", () => S.go("about")],
    ["Contact", () => S.go("contact")],
  ];
  return (
    <>
      <div className="topbar">
        <span>Free insured shipping over ₹2,999 · Every bead X-ray certified · Puja slots open for Shravan</span>
      </div>
      <header className={`site ${stuck ? "stuck" : ""}`} onMouseLeave={() => setMega(false)}>
        <div className="wrap hrow">
          <button className="logo" onClick={() => S.go("home")} aria-label="Divyaloka home">
            <span className="logo-mark"><LotusMark /></span>
            <span style={{ textAlign: "left" }}>
              <span className="logo-txt">Divyaloka</span>
              <span className="logo-sub">Since 1974 · Kashi</span>
            </span>
          </button>

          <nav className="main">
            {nav.map(([label, fn]) => (
              <button key={label}
                className={S.route === label.toLowerCase() ? "on" : ""}
                onMouseEnter={() => setMega(label === "Categories")}
                onClick={() => (fn ? fn() : setMega((m) => !m))}>
                {label}
              </button>
            ))}
          </nav>

          <div className="hicons">
            <button className="btn btn-primary btn-sm" style={{ marginRight: 8 }} onClick={() => S.go("puja")}>
              Book Puja
            </button>
            <button className="icobtn" aria-label="Search" onClick={() => S.setSearch(true)}>{I.search}</button>
            <button className="icobtn" aria-label="Wishlist" onClick={() => S.go("account", { tab: "Wishlist" })}>
              {I.heart(false)}{S.wish.length > 0 && <span className="badge">{S.wish.length}</span>}
            </button>
            <button className="icobtn" aria-label="Cart" onClick={() => S.setCartOpen(true)}>
              {I.bag}{S.cartCount > 0 && <span className="badge">{S.cartCount}</span>}
            </button>
            <button className="icobtn" aria-label="Account" onClick={() => S.go(S.user ? "account" : "login")}>{I.user}</button>
            <button className="icobtn" aria-label="Toggle theme" onClick={S.toggleTheme}>{S.theme === "dark" ? I.sun : I.moon}</button>
            <button className="icobtn burger" aria-label="Menu" onClick={() => setMob(true)}>{I.menu}</button>
          </div>
        </div>

        {mega && (
          <div className="mega" onMouseLeave={() => setMega(false)}>
            <div className="wrap mega-grid">
              {(S.categories ?? []).map((g: any) => (
                <div key={g.group}>
                  <h4>{g.group}</h4>
                  <ul>
                    {g.items.map((c: any) => (
                      <li key={c.name}><button onClick={() => { setMega(false); S.go("shop", { cat: c.name }); }}>{c.name}</button></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {mob && (
        <>
          <div className="scrim" onClick={() => setMob(false)} />
          <aside className="drawer" style={{ left: 0, right: "auto", animation: "slide .4s reverse" }}>
            <div className="drawer-head">
              <span className="logo-txt">Menu</span>
              <button className="icobtn" onClick={() => setMob(false)} aria-label="Close menu">{I.x}</button>
            </div>
            <div className="drawer-body">
              {nav.filter(([, f]) => f).map(([l, f]) => (
                <button key={l} style={{ display: "block", padding: "13px 0", fontSize: "1.02rem", borderBottom: "1px solid var(--line-2)", width: "100%", textAlign: "left" }}
                  onClick={() => { f(); setMob(false); }}>{l}</button>
              ))}
              <h4 style={{ margin: "26px 0 10px" }} className="eyebrow">Shop by category</h4>
              {(S.categories ?? []).flatMap((g: any) => g.items).map((c: any) => (
                <button key={c.name} style={{ display: "block", padding: "9px 0", color: "var(--ink-2)", width: "100%", textAlign: "left" }}
                  onClick={() => { S.go("shop", { cat: c.name }); setMob(false); }}>{c.name}</button>
              ))}
            </div>
            <div className="drawer-foot">
              <button className="btn btn-primary btn-block" onClick={() => { S.go("puja"); setMob(false); }}>Book Puja</button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

/* ============================ SEARCH ============================ */

function SearchOverlay() {
  const S = useShop();
  const [q, setQ] = useState("");
  const [listening, setListening] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && S.setSearch(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [S]);
  const [hits, setHits] = useState<any[]>([]);
  const [pujaHits, setPujaHits] = useState<any[]>([]);
  const [popular, setPopular] = useState<any[]>([]);

  // Suggestions for the empty state, so "recently viewed" is never invented.
  useEffect(() => {
    api.products({ sort: "best", take: 4 }).then((r) => {
      setPopular(r?.items?.length ? normProducts(r.items) : PRODUCTS.slice(0, 4));
    });
  }, []);

  // Search runs against the database, debounced so typing does not spam the API.
  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits([]); setPujaHits([]); return; }

    let cancelled = false;
    const t = setTimeout(async () => {
      const [products, pujas] = await Promise.all([api.products({ q: term, take: 6 }), api.pujas()]);
      if (cancelled) return;

      setHits(products?.items?.length
        ? normProducts(products.items)
        : PRODUCTS.filter((p) => (p.name + p.category).toLowerCase().includes(term.toLowerCase())).slice(0, 6));

      const pool = pujas?.length ? pujas.map(normPuja) : PUJAS;
      setPujaHits(pool.filter((p: any) => p.name.toLowerCase().includes(term.toLowerCase())).slice(0, 3));
    }, 220);

    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);
  return (
    <>
      <div className="scrim" onClick={() => S.setSearch(false)} />
      <div className="sheet" style={{ top: "12vh", padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 24px", borderBottom: "1px solid var(--line-2)" }}>
          {I.search}
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search malas, pujas, gemstones…"
            style={{ flex: 1, border: 0, background: "none", fontSize: "1.1rem", fontFamily: "var(--display)", outline: "none" }} />
          <button className="icobtn" title="Voice search" aria-label="Voice search"
            onClick={() => { setListening(true); setTimeout(() => { setQ("panchmukhi"); setListening(false); }, 1100); }}
            style={{ color: listening ? "var(--saffron)" : undefined }}>{I.mic}</button>
          <button className="icobtn" onClick={() => S.setSearch(false)} aria-label="Close search">{I.x}</button>
        </div>
        <div style={{ padding: 24 }}>
          {q === "" ? (
            <>
              <p className="eyebrow" style={{ marginBottom: 12 }}>Trending this week</p>
              <div className="chips">
                {["Panchmukhi mala", "Rudrabhishek booking", "Sphatik", "Gift box under ₹5,000", "Ek Mukhi", "Meditation kurta"].map((t) => (
                  <button key={t} className="chip" onClick={() => setQ(t.split(" ")[0])}>{t}</button>
                ))}
              </div>
              <p className="eyebrow" style={{ margin: "26px 0 12px" }}>Recently viewed</p>
              <div className="grid g4">
                {(S.recent.length ? S.recent : popular).slice(0, 4).map((p: any) => (
                  <button key={p.id} onClick={() => { S.setSearch(false); S.openProduct(p); }} style={{ textAlign: "left" }}>
                    <div style={{ borderRadius: 10, overflow: "hidden", background: "var(--surface-2)", aspectRatio: 1 }}>
                      <Art kind={p.kind} tone={p.tone} mukhi={p.mukhi} id={`s${p.id}`} />
                    </div>
                    <span style={{ fontSize: ".8rem", display: "block", marginTop: 8 }}>{p.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {hits.length === 0 && pujaHits.length === 0 && (
                <p className="muted">Nothing matches “{q}”. Try a mukhi number, a gemstone, or a puja name.</p>
              )}
              {hits.map((p) => (
                <button key={p.id} onClick={() => { S.setSearch(false); S.openProduct(p); }}
                  style={{ display: "flex", gap: 14, alignItems: "center", width: "100%", padding: "10px 0", textAlign: "left", borderBottom: "1px solid var(--line-2)" }}>
                  <span style={{ width: 46, height: 46, borderRadius: 9, overflow: "hidden", background: "var(--surface-2)", flexShrink: 0 }}>
                    <Art kind={p.kind} tone={p.tone} mukhi={p.mukhi} id={`q${p.id}`} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <b style={{ fontFamily: "var(--display)", fontWeight: 500 }}>{p.name}</b>
                    <span className="pc-cat" style={{ display: "block" }}>{p.category}</span>
                  </span>
                  <b>{money(p.price)}</b>
                </button>
              ))}
              {pujaHits.map((p) => (
                <button key={p.id} onClick={() => { S.setSearch(false); S.go("puja", { puja: p.id }); }}
                  style={{ display: "flex", gap: 14, alignItems: "center", width: "100%", padding: "12px 0", textAlign: "left", borderBottom: "1px solid var(--line-2)" }}>
                  <span style={{ width: 46, height: 46, borderRadius: 9, background: "var(--surface-2)", display: "grid", placeItems: "center" }}>{I.cal}</span>
                  <span style={{ flex: 1 }}>
                    <b style={{ fontFamily: "var(--display)", fontWeight: 500 }}>{p.name}</b>
                    <span className="pc-cat" style={{ display: "block" }}>Puja booking · {p.dur}</span>
                  </span>
                  {I.chev}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ============================ CART ============================ */

function CartDrawer() {
  const S = useShop();
  const free = 2999;
  const gap = Math.max(0, free - S.subtotal);
  return (
    <>
      <div className="scrim" onClick={() => S.setCartOpen(false)} />
      <aside className="drawer" role="dialog" aria-label="Shopping bag">
        <div className="drawer-head">
          <div>
            <h3>Your bag</h3>
            <span className="muted" style={{ fontSize: ".78rem" }}>{S.cartCount} item{S.cartCount === 1 ? "" : "s"}</span>
          </div>
          <button className="icobtn" onClick={() => S.setCartOpen(false)} aria-label="Close bag">{I.x}</button>
        </div>

        {S.cart.length > 0 && (
          <div style={{ padding: "12px 24px", background: "var(--surface-2)", fontSize: ".78rem" }}>
            {gap > 0 ? <>Add {money(gap)} more for free insured shipping</> : <>Free insured shipping unlocked</>}
            <div style={{ height: 4, background: "var(--line)", borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (S.subtotal / free) * 100)}%`, background: "linear-gradient(90deg,var(--saffron-soft),var(--saffron))", transition: "width .6s" }} />
            </div>
          </div>
        )}

        <div className="drawer-body">
          {S.cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ width: 120, margin: "0 auto 18px", opacity: .55 }}><Art kind="bead" tone="rudraksha" mukhi={5} id="empty" /></div>
              <h3>Your bag is empty</h3>
              <p className="muted" style={{ margin: "8px 0 22px" }}>Start with the mala our sadhaks return for most.</p>
              <button className="btn btn-primary" onClick={() => { S.setCartOpen(false); S.go("shop"); }}>Browse the store</button>
            </div>
          ) : S.cart.map((l) => (
            <div key={l.key} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--line-2)" }}>
              <div style={{ width: 78, height: 78, borderRadius: 11, overflow: "hidden", background: "var(--surface-2)", flexShrink: 0 }}>
                {l.type === "puja" ? <div style={{ display: "grid", placeItems: "center", height: "100%" }}>{I.cal}</div>
                  : <Art kind={l.kind} tone={l.tone} mukhi={l.mukhi} id={`c${l.key}`} />}
              </div>
              <div style={{ flex: 1 }}>
                <b style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: ".98rem" }}>{l.name}</b>
                <div className="pc-cat" style={{ marginTop: 3 }}>{l.meta || l.category}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 999 }}>
                    <button style={{ padding: "4px 11px" }} onClick={() => S.setQty(l.key, l.qty - 1)} aria-label="Decrease quantity">−</button>
                    <span style={{ fontSize: ".84rem", minWidth: 18, textAlign: "center" }}>{l.qty}</span>
                    <button style={{ padding: "4px 11px" }} onClick={() => S.setQty(l.key, l.qty + 1)} aria-label="Increase quantity">+</button>
                  </div>
                  <b>{money(l.price * l.qty)}</b>
                </div>
              </div>
            </div>
          ))}

          {S.cart.length > 0 && (
            <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 20, fontSize: ".85rem" }}>
              <input type="checkbox" checked={S.giftWrap} onChange={(e) => S.setGiftWrap(e.target.checked)} />
              Add hand-tied gift wrap and a sankalp card (+₹149)
            </label>
          )}
        </div>

        {S.cart.length > 0 && (
          <div className="drawer-foot">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="muted">Subtotal</span><b>{money(S.subtotal)}</b>
            </div>
            {S.discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#2E7D4F" }}>
                <span>Coupon {S.coupon}</span><b>−{money(S.discount)}</b>
              </div>
            )}
            <p className="muted" style={{ fontSize: ".74rem", marginBottom: 14 }}>Taxes and shipping calculated at checkout.</p>
            <button className="btn btn-primary btn-block" onClick={() => { S.setCartOpen(false); S.go("checkout"); }}>Checkout securely</button>
          </div>
        )}
      </aside>
    </>
  );
}

/* ============================ PRODUCT CARD ============================ */

function ProductCard({ p, delay = 0 }: { p: any; delay?: number }) {
  const S = useShop();
  const off = Math.round(((p.mrp - p.price) / p.mrp) * 100);
  const wished = S.wish.includes(p.id);
  return (
    <Reveal delay={delay} className="card">
      <div className="pc-media">
        {p.badge && <span className={`tag ${p.badge === "Rare" || p.badge === "Signature" ? "gold" : ""}`}>{p.badge}</span>}
        <button className={`wish ${wished ? "on" : ""}`} aria-label={wished ? "Remove from wishlist" : "Save to wishlist"}
          onClick={(e) => { e.stopPropagation(); S.toggleWish(p.id); }}>{I.heart(wished)}</button>
        <button onClick={() => S.openProduct(p)} style={{ width: "100%", height: "100%", display: "block" }} aria-label={`View ${p.name}`}>
          <Art kind={p.kind} tone={p.tone} mukhi={p.mukhi} id={`p${p.id}`} />
        </button>
        <div className="quick">
          <button className="btn btn-ghost btn-sm btn-block" onClick={() => S.add(p)}>
            {p.stock > 0 ? "Add to bag" : "Notify me"}
          </button>
        </div>
      </div>
      <div className="pc-body">
        <span className="pc-cat">{p.category}</span>
        <button onClick={() => S.openProduct(p)} style={{ textAlign: "left", width: "100%" }}>
          <h3 className="pc-name">{p.name}</h3>
        </button>
        <Stars v={p.rating} n={p.reviews} />
        <div className="price"><b>{money(p.price)}</b><s>{money(p.mrp)}</s><i>{off}% off</i></div>
      </div>
    </Reveal>
  );
}

const SkeletonCard = () => (
  <div className="card">
    <div className="sk" style={{ aspectRatio: 1, borderRadius: 0 }} />
    <div style={{ padding: 17 }}>
      <div className="sk" style={{ height: 9, width: "40%" }} />
      <div className="sk" style={{ height: 15, width: "82%", marginTop: 11 }} />
      <div className="sk" style={{ height: 13, width: "54%", marginTop: 11 }} />
    </div>
  </div>
);

/* ============================ FOOTER ============================ */

function Footer() {
  const S = useShop();
  const [mail, setMail] = useState("");
  const cols: Array<[string, string[]]> = [
    ["Shop", ["Rudraksha Mala", "Rudraksha Bracelet", "Gemstone Mala", "Spiritual Clothing", "Gift Boxes"]],
    ["Puja services", ["Rudrabhishek", "Griha Pravesh", "Satyanarayan Katha", "Navgraha Puja", "Customized Puja"]],
    ["Help", ["Track your order", "Shipping policy", "Returns & refunds", "Authenticity promise", "Contact us"]],
    ["Company", ["Our story", "Sourcing & ethics", "Blog", "Careers", "Terms & privacy"]],
  ];
  return (
    <footer className="site">
      <div className="wrap">
        <div className="grid" style={{ gridTemplateColumns: "1.4fr repeat(4,1fr)", gap: 34 }}>
          <div>
            <div style={{ display: "flex", gap: 11, alignItems: "center", marginBottom: 14 }}>
              <LotusMark size={34} />
              <span className="logo-txt" style={{ color: "#fff" }}>Divyaloka</span>
            </div>
            <p style={{ fontSize: ".88rem", maxWidth: "34ch" }}>
              Fifty-one years of sourcing from the Himalayan belt. Every bead X-rayed, every pandit verified in person.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              {["IG", "YT", "FB", "IN"].map((s) => (
                <button key={s} style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(234,223,200,.24)", fontSize: ".68rem", color: "inherit" }}>{s}</button>
              ))}
            </div>
          </div>
          {cols.map(([h, items]) => (
            <div key={h}>
              <h4>{h}</h4>
              {items.map((it) => <button key={it} onClick={() => S.go(h === "Puja services" ? "puja" : "shop")}>{it}</button>)}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 30, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginTop: 46, padding: "26px 0", borderTop: "1px solid rgba(234,223,200,.14)", borderBottom: "1px solid rgba(234,223,200,.14)" }}>
          <div>
            <h4 style={{ marginBottom: 6 }}>Panchang & new arrivals</h4>
            <p style={{ fontSize: ".85rem" }}>One letter a week: upcoming muhurats, restocks, nothing else.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flex: "1 1 320px", maxWidth: 460 }}>
            <input className="inp" value={mail} onChange={(e) => setMail(e.target.value)} placeholder="you@email.com"
              style={{ background: "rgba(255,255,255,.06)", borderColor: "rgba(234,223,200,.2)", color: "#fff" }} />
            <button className="btn btn-gold" onClick={() => { S.toast(mail.includes("@") ? "Subscribed. Check your inbox." : "Enter a valid email address."); setMail(""); }}>Subscribe</button>
          </div>
        </div>

        <div className="fbot">
          <span>© 2026 Divyaloka Spiritual Retail Pvt. Ltd. · GSTIN 09AABCD1234E1Z5</span>
          <span style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <button onClick={() => S.go("admin")}>Admin panel</button>
            <button onClick={() => S.go("pandit")}>Pandit panel</button>
            <span>Razorpay · Stripe · UPI</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ============================ FLOATING HELPERS ============================ */

function FloatingHelp() {
  const S = useShop();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ b: 1, t: "Namaste. I can help you pick a mukhi, check an order, or find a muhurat. What are you looking for?" }]);
  const [txt, setTxt] = useState("");
  const send = (t) => {
    if (!t.trim()) return;
    const reply = /puja|booking|muhurat/i.test(t) ? "Shravan Mondays are open for Rudrabhishek. Tap Book Puja and pick a date — I will hold a pandit for 15 minutes."
      : /mukhi|which|bead/i.test(t) ? "For focus and calm, start with Panchmukhi. For protection while travelling, Gauri Shankar. Both ship with an X-ray report."
        : /order|track/i.test(t) ? "Share your order number and I will pull the tracking for you."
          : "I have noted that. A human advisor picks up this thread within 4 minutes during 9am–9pm IST.";
    setMsgs((m) => [...m, { b: 0, t }, { b: 1, t: reply }]);
    setTxt("");
  };
  return (
    <>
      <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 70, display: "grid", gap: 10, justifyItems: "end" }}>
        {open && (
          <div style={{ width: "min(340px,92vw)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, boxShadow: "var(--shadow-lg)", overflow: "hidden", animation: "pop .3s" }}>
            <div style={{ padding: "14px 18px", background: "var(--brown)", color: "var(--cream)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span><b style={{ fontFamily: "var(--display)", fontWeight: 500 }}>Ask Divyaloka</b><br /><span style={{ fontSize: ".7rem", opacity: .7 }}>Replies in under 4 minutes</span></span>
              <button onClick={() => setOpen(false)} aria-label="Close chat" style={{ color: "inherit" }}>{I.x}</button>
            </div>
            <div style={{ maxHeight: 260, overflowY: "auto", padding: 16, display: "grid", gap: 10 }}>
              {msgs.map((m, i) => (
                <div key={i} style={{
                  justifySelf: m.b ? "start" : "end", maxWidth: "86%", fontSize: ".85rem", padding: "10px 13px", borderRadius: 13,
                  background: m.b ? "var(--surface-2)" : "var(--brown)", color: m.b ? "var(--ink)" : "var(--cream)"
                }}>{m.t}</div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line-2)" }}>
              <input className="inp" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Type a message"
                onKeyDown={(e) => e.key === "Enter" && send(txt)} />
              <button className="btn btn-primary btn-sm" onClick={() => send(txt)}>Send</button>
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button aria-label="WhatsApp" onClick={() => S.toast("Opening WhatsApp: +91 98765 43210")}
            style={{ width: 52, height: 52, borderRadius: "50%", background: "#25D366", color: "#fff", display: "grid", placeItems: "center", boxShadow: "var(--shadow)" }}>{I.chat}</button>
          <button aria-label="Chat with us" onClick={() => setOpen((o) => !o)}
            style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--brown)", color: "var(--gold-light)", display: "grid", placeItems: "center", boxShadow: "var(--shadow)" }}>
            {open ? I.x : <span style={{ fontFamily: "var(--display)", fontSize: "1.1rem" }}>ॐ</span>}
          </button>
        </div>
      </div>
    </>
  );
}

export { Shop, useShop, useReveal, Reveal, Stars, Header, SearchOverlay, CartDrawer, ProductCard, SkeletonCard, Footer, FloatingHelp };
