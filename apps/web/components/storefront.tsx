"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Art, ProductArt, I, LotusMark } from "./art";
import { money } from "../lib/format";
import { Shop, useShop, Reveal, Stars, ProductCard, SkeletonCard } from "./shell";
import { api } from "../lib/api";
import { normProducts, normTestimonial, normPost } from "../lib/normalise";


/* ============================ HOME ============================ */

function Home({ products, testimonials, posts }: { products?: any[]; testimonials?: any[]; posts?: any[] } = {}) {
  const S = useShop();
  const [loading, setLoading] = useState(!products?.length);
  // Prefilled from the server so the first paint is already the real catalogue.
  // Never seeded with bundled data — that would show products nobody can buy.
  const [live, setLive] = useState<any[]>(products ?? []);
  const [quotes, setQuotes] = useState<any[]>(testimonials ?? []);
  const [journal, setJournal] = useState<any[]>(posts ?? []);

  useEffect(() => {
    if (products?.length) return;
    let cancelled = false;

    Promise.all([
      api.products({ take: 24, sort: "featured" }),
      api.testimonials(4),
      api.posts(4),
    ]).then(([p, t, b]) => {
      if (cancelled) return;
      setLive(normProducts(p?.items ?? []));
      setQuotes((t ?? []).map(normTestimonial));
      setJournal((b ?? []).map(normPost));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [products]);

  const pick = (from: number, to: number) => live.slice(from, to);

  const featured = [
    { c: "Rudraksha Mala", s: "108 + guru bead", k: "mala", t: "rudraksha", m: 5 },
    { c: "Rudraksha Bracelet", s: "Daily wear", k: "bracelet", t: "rudraksha", m: 5 },
    { c: "Gemstone Mala", s: "Certified stones", k: "mala", t: "emerald", m: 4 },
    { c: "Spiritual Clothing", s: "Handloom", k: "cloth", t: "saffronCloth", m: 4 },
    { c: "Puja Samagri", s: "Ritual-ordered", k: "samagri", t: "gold", m: 4 },
    { c: "Yantras", s: "Hand-engraved", k: "yantra", t: "gold", m: 4 },
  ];

  return (
    <main>
      {/* ---- Hero ---- */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="wrap hero-in">
          <div>
            <span className="eyebrow">Kashi · Est. 1974</span>
            <h1>The bead you wear<br />should be <em>provable</em>.</h1>
            <p className="lede">
              Every Rudraksha we sell arrives with its own X-ray scan, mukhi count verified by a lab, and a tamper seal you break yourself. Nothing is described as "energised" unless we can tell you where, when and by whom.
            </p>
            <div className="hero-cta">
              <button className="btn btn-primary" onClick={() => S.go("shop")}>Shop the collection {I.chev}</button>
              <button className="btn btn-ghost" onClick={() => S.go("puja")}>{I.cal} Book a puja</button>
            </div>
            <div className="trustrow">
              <div className="trust"><b>51</b><span>Years sourcing</span></div>
              <div className="trust"><b>1.2 L</b><span>Beads X-rayed</span></div>
              <div className="trust"><b>340</b><span>Verified pandits</span></div>
              <div className="trust"><b>4.9</b><span>Average rating</span></div>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <div className="arch">
              <div style={{ position: "absolute", inset: "8%" }}>
                <Art kind="mala" tone="rudraksha" mukhi={5} id="hero" />
              </div>
              <div className="arch-tag">Panchmukhi 108 · Nepal · 8 mm</div>
            </div>
            <div className="float-card a">{I.shield}<span><b>X-ray verified</b><br /><span className="muted" style={{ fontSize: ".72rem" }}>Report in every box</span></span></div>
            <div className="float-card b">{I.leaf}<span><b>Ethically harvested</b><br /><span className="muted" style={{ fontSize: ".72rem" }}>Direct from 6 farms</span></span></div>
          </div>
        </div>
      </section>

      <div className="strip">
        <div className="strip-in">
          {[0, 1].map((k) => (
            <React.Fragment key={k}>
              <span>◆ Free insured shipping over ₹2,999</span><span>◆ 7-day no-questions returns</span>
              <span>◆ Lab certificate with every bead</span><span>◆ Same-day puja slots</span>
              <span>◆ Ships to 41 countries</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ---- Categories ---- */}
      <section className="sec wrap">
        <Reveal className="sec-head">
          <div><span className="eyebrow">Browse</span><h2>Start where your practice is</h2>
            <p>Six shelves, arranged the way a temple store is — not the way a database is.</p></div>
          <button className="link-more" onClick={() => S.go("shop")}>All categories</button>
        </Reveal>
        <div className="grid g3">
          {featured.map((f, i) => (
            <Reveal key={f.c} delay={i * 60}>
              <figure className="cat-tile" onClick={() => S.go("shop", { cat: f.c })} style={{ cursor: "pointer" }}>
                <div style={{ position: "absolute", inset: "10%" }}><Art kind={f.k} tone={f.t} mukhi={f.m} id={`cat${i}`} /></div>
                <figcaption><b>{f.c}</b><span>{f.s}</span></figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---- Best sellers ---- */}
      <section className="sec" style={{ background: "var(--surface-2)" }}>
        <div className="wrap">
          <Reveal className="sec-head">
            <div><span className="eyebrow">Best sellers</span><h2>What sadhaks reorder</h2>
              <p>Ranked by repeat purchase, not by margin.</p></div>
            <button className="link-more" onClick={() => S.go("shop", { sort: "Best selling" })}>See all</button>
          </Reveal>
          <div className="grid g4">
            {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : pick(0, 4).map((p: any, i: number) => <ProductCard key={p.id} p={p} delay={i * 70} />)}
          </div>
        </div>
      </section>

      {/* ---- Signature / rare ---- */}
      <section className="sec wrap">
        <Reveal className="sec-head">
          <div><span className="eyebrow">The vault</span><h2>Rare & collector beads</h2>
            <p>Single-owner pieces. Each one photographed, weighed and scanned before it is listed.</p></div>
        </Reveal>
        <div className="grid" style={{ gridTemplateColumns: "1.1fr 1fr 1fr" }}>
          <Reveal className="card" style={{ gridRow: "span 1" }}>
            <div className="pc-media" style={{ aspectRatio: "auto", height: "100%", minHeight: 400 }}>
              <span className="tag gold">1 of 2 left</span>
              <div style={{ position: "absolute", inset: "12%" }}><Art kind="bead" tone="rudraksha" mukhi={1} id="rare" /></div>
              <div className="arch-tag" style={{ position: "absolute" }}>Ek Mukhi · Java · 24 mm · {money(84999)}</div>
            </div>
          </Reveal>
          {pick(4, 8).map((p: any, i: number) => <ProductCard key={p.id} p={p} delay={i * 70} />)}
        </div>
      </section>

      {/* ---- Book puja band ---- */}
      <section className="wrap" style={{ paddingBottom: 76 }}>
        <Reveal className="puja-band">
          <div className="kolam"><Art kind="yantra" tone="gold" id="band" /></div>
          <div style={{ position: "relative" }}>
            <span className="eyebrow" style={{ color: "var(--gold-light)" }}>Puja services</span>
            <h2 style={{ margin: "14px 0 14px" }}>A pandit who arrives<br />on time, with the vidhi you asked for.</h2>
            <p style={{ color: "rgba(251,246,236,.75)", maxWidth: "46ch" }}>
              Choose online, at your home, or hybrid for family abroad. Fees are fixed before booking — samagri list, dakshina and travel are all itemised.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
              <button className="btn btn-gold" onClick={() => S.go("puja")}>Book a puja</button>
              <button className="btn btn-ghost" style={{ background: "transparent", borderColor: "rgba(227,199,126,.4)", color: "var(--cream)" }}
                onClick={() => S.go("puja")}>Meet the pandits</button>
            </div>
          </div>
          <div className="mini-steps">
            {[["Choose the puja", "12 vidhis, or describe your own sankalp"],
            ["Pick mode & muhurat", "Online, offline or hybrid — panchang-checked dates"],
            ["Meet your pandit", "Profiles with veda, languages, and real reviews"],
            ["Track everything", "Reschedule, receipts, recording — all in your account"]].map(([t, d], i) => (
              <div className="mini-step" key={t}>
                <span className="mini-num">0{i + 1}</span>
                <div><b>{t}</b><p>{d}</p></div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---- Clothing / collection split ---- */}
      <section className="sec" style={{ background: "var(--surface-2)" }}>
        <div className="wrap">
          <Reveal className="sec-head">
            <div><span className="eyebrow">Latest collection</span><h2>Sattva — handloom for sitting still</h2>
              <p>Cotton that breathes through a two-hour sit. Cut wide at the knee, tapered at the ankle.</p></div>
            <button className="link-more" onClick={() => S.go("shop", { cat: "Kurta" })}>Shop clothing</button>
          </Reveal>
          <div className="grid g4">
            {pick(8, 12).map((p: any, i: number) => <ProductCard key={p.id} p={p} delay={i * 70} />)}
          </div>
        </div>
      </section>

      {/* ---- Festival offer ---- */}
      <section className="sec wrap">
        <Reveal style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }} className="grid g2">
          <div style={{ background: "linear-gradient(135deg,var(--saffron-soft),var(--saffron) 55%,var(--saffron-deep))", borderRadius: 20, padding: 40, color: "#fff", position: "relative", overflow: "hidden" }}>
            <span className="eyebrow" style={{ color: "rgba(255,255,255,.8)" }}>Shravan offer · ends in 6 days</span>
            <h2 style={{ color: "#fff", margin: "12px 0 10px" }}>20% off all Rudrabhishek bookings</h2>
            <p style={{ color: "rgba(255,255,255,.86)", maxWidth: "38ch" }}>Use code SHRAVAN20 at checkout. Applies to online and hybrid bookings on Mondays.</p>
            <button className="btn" style={{ background: "#fff", color: "var(--saffron-deep)", marginTop: 24 }} onClick={() => S.go("puja", { puja: "rudra" })}>Claim the offer</button>
            <div style={{ position: "absolute", right: -40, bottom: -50, width: 220, opacity: .22 }}><Art kind="samagri" tone="cream" id="fest" /></div>
          </div>
          <div style={{ background: "var(--brown)", borderRadius: 20, padding: 40, color: "var(--cream)", position: "relative", overflow: "hidden" }}>
            <span className="eyebrow" style={{ color: "var(--gold-light)" }}>Refer & earn</span>
            <h2 style={{ color: "#fff", margin: "12px 0 10px" }}>₹500 for them, 500 points for you</h2>
            <p style={{ color: "rgba(251,246,236,.75)", maxWidth: "38ch" }}>Points convert 1:1 to rupees on any order above ₹2,000. No expiry, no tiers, no catch.</p>
            <button className="btn btn-gold" style={{ marginTop: 24 }} onClick={() => S.go("account", { tab: "Refer & earn" })}>Get my link</button>
            <div style={{ position: "absolute", right: -30, bottom: -40, width: 200, opacity: .2 }}><Art kind="gift" tone="gold" id="ref" /></div>
          </div>
        </Reveal>
      </section>

      {/* ---- Testimonials ---- */}
      <section className="sec" style={{ background: "var(--surface-2)" }}>
        <div className="wrap">
          <Reveal className="sec-head">
            <div><span className="eyebrow">Verified buyers</span><h2>What people actually wrote</h2>
              <p>Reviews are only published from confirmed orders and completed bookings.</p></div>
          </Reveal>
          <div className="grid g4">
            {quotes.map((t: any, i: number) => (
              <Reveal key={t.id ?? i} delay={i * 70} className="quote">
                <Stars v={t.rating} />
                <p>“{t.text}”</p>
                <div style={{ marginTop: "auto", display: "flex", gap: 12, alignItems: "center" }}>
                  <span className="avatar">{(t.name ?? "?")[0]}</span>
                  <span><b style={{ fontSize: ".88rem" }}>{t.name}</b><br />
                    <span className="muted" style={{ fontSize: ".74rem" }}>
                      {[t.city, t.product].filter(Boolean).join(" · ")}
                    </span></span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Blog + instagram ---- */}
      <section className="sec wrap">
        <Reveal className="sec-head">
          <div><span className="eyebrow">Journal</span><h2>Learn before you buy</h2>
            <p>Written by our sourcing team and two of our senior pandits.</p></div>
          <button className="link-more" onClick={() => S.go("blog")}>All articles</button>
        </Reveal>
        <div className="grid g4">
          {journal.map((b: any, i: number) => (
            <Reveal key={b.slug ?? b.title} delay={i * 70} className="card" style={{ cursor: "pointer" }}
              onClick={() => b.slug && S.go("blog", { post: b.slug })}>
              <div className="pc-media" style={{ aspectRatio: "3/2" }}>
                <div style={{ position: "absolute", inset: "14%" }}><Art kind={i % 2 ? "book" : "bead"} tone={i % 2 ? "cream" : "rudraksha"} mukhi={i + 1} id={`b${i}`} /></div>
              </div>
              <div className="pc-body">
                <span className="pc-cat">{b.category} · {b.readMinutes} min read</span>
                <h3 className="pc-name">{b.title}</h3>
                <p className="muted" style={{ fontSize: ".84rem" }}>{b.excerpt}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal style={{ marginTop: 60 }}>
          <div className="sec-head">
            <div><span className="eyebrow">@divyaloka</span><h2>From the workshop</h2></div>
            <button className="link-more" onClick={() => S.toast("Opening Instagram @divyaloka")}>Follow us</button>
          </div>
          <div className="grid g5" style={{ gap: 12 }}>
            {["mala", "bead", "samagri", "yantra", "incense"].map((k, i) => (
              <div key={k} style={{ borderRadius: 12, overflow: "hidden", aspectRatio: 1, background: "linear-gradient(160deg,var(--beige),var(--sand))", cursor: "pointer" }}>
                <Art kind={k} tone={i % 2 ? "gold" : "rudraksha"} mukhi={i + 2} id={`ig${i}`} />
              </div>
            ))}
          </div>
        </Reveal>
      </section>
    </main>
  );
}

/* ============================ SHOP ============================ */

function ShopPage({ products }: { products?: any[] } = {}) {
  const S = useShop();
  const q = S.params;
  const [cat, setCat] = useState(q.cat || "All");
  const [sort, setSort] = useState(q.sort || "Featured");
  const [max, setMax] = useState(90000);
  const [mukhi, setMukhi] = useState([]);
  const [onlyStock, setOnlyStock] = useState(false);
  // Prefilled from the server means there is nothing to wait for on first paint.
  const [loading, setLoading] = useState(!products?.length);
  const [catalogue, setCatalogue] = useState<any[]>(products ?? []);

  useEffect(() => { setCat(q.cat || "All"); }, [q.cat]);

  // The database is the catalogue, full stop. If it cannot answer, the grid stays
  // empty and says so rather than showing pieces nobody can actually buy.
  useEffect(() => {
    if (products?.length) return;
    api.products({ take: 60 }).then((r) => {
      setCatalogue(normProducts(r?.items ?? []));
    });
  }, [products]);
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 420); return () => clearTimeout(t); }, [cat, sort, max, mukhi.length, onlyStock]);

  const list = useMemo(() => {
    let r = catalogue.filter((p) => (cat === "All" || p.category === cat) && p.price <= max
      && (!onlyStock || p.stock > 0) && (mukhi.length === 0 || mukhi.includes(p.mukhi)));
    if (sort === "Price: low to high") r = [...r].sort((a, b) => a.price - b.price);
    if (sort === "Price: high to low") r = [...r].sort((a, b) => b.price - a.price);
    if (sort === "Best selling") r = [...r].sort((a, b) => b.reviews - a.reviews);
    if (sort === "Top rated") r = [...r].sort((a, b) => b.rating - a.rating);
    return r;
  }, [cat, sort, max, mukhi, onlyStock, catalogue]);

  const allCats = ["All", ...Array.from(new Set(catalogue.map((p: any) => p.category)))];

  return (
    <main className="wrap" style={{ padding: "38px 24px 70px" }}>
      <div style={{ fontSize: ".76rem", color: "var(--ink-3)", marginBottom: 18 }}>
        <button onClick={() => S.go("home")}>Home</button> / <span>Shop</span>{cat !== "All" && <> / <span style={{ color: "var(--ink)" }}>{cat}</span></>}
      </div>

      <div className="sec-head" style={{ marginBottom: 26 }}>
        <div>
          <span className="eyebrow">{list.length} pieces</span>
          <h2>{cat === "All" ? "The full collection" : cat}</h2>
          <p>{cat === "All" ? "Filter by mukhi, price or availability. Everything listed is in hand at our Varanasi warehouse." : "Each piece in this shelf ships with its lab certificate and care card."}</p>
        </div>
        <select className="inp" style={{ width: 210 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products">
          {["Featured", "Best selling", "Top rated", "Price: low to high", "Price: high to low"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "236px 1fr", alignItems: "start", gap: 34 }}>
        <aside style={{ position: "sticky", top: 100 }}>
          <h4 className="eyebrow" style={{ marginBottom: 12 }}>Category</h4>
          <div style={{ display: "grid", gap: 2, marginBottom: 26, maxHeight: 280, overflowY: "auto" }}>
            {allCats.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                style={{ textAlign: "left", padding: "6px 0", fontSize: ".88rem", color: c === cat ? "var(--saffron-deep)" : "var(--ink-2)", fontWeight: c === cat ? 500 : 400 }}>
                {c}
              </button>
            ))}
          </div>

          <h4 className="eyebrow" style={{ marginBottom: 12 }}>Mukhi</h4>
          <div className="chips" style={{ marginBottom: 26 }}>
            {[1, 3, 4, 5, 6].map((m) => (
              <button key={m} className={`chip ${mukhi.includes(m) ? "on" : ""}`}
                onClick={() => setMukhi((x) => x.includes(m) ? x.filter((y) => y !== m) : [...x, m])}>{m} mukhi</button>
            ))}
          </div>

          <h4 className="eyebrow" style={{ marginBottom: 12 }}>Max price — {money(max)}</h4>
          <input type="range" min="500" max="90000" step="500" value={max} onChange={(e) => setMax(+e.target.value)}
            style={{ width: "100%", accentColor: "var(--saffron)" }} aria-label="Maximum price" />

          <label style={{ display: "flex", gap: 9, alignItems: "center", marginTop: 22, fontSize: ".86rem" }}>
            <input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} /> In stock only
          </label>

          <div style={{ marginTop: 28, padding: 18, background: "var(--surface-2)", borderRadius: 14 }}>
            <b style={{ fontFamily: "var(--display)", fontWeight: 500 }}>Not sure which mukhi?</b>
            <p className="muted" style={{ fontSize: ".82rem", margin: "6px 0 14px" }}>Answer four questions and we will shortlist three beads.</p>
            <button className="btn btn-ghost btn-sm btn-block" onClick={() => S.toast("Bead finder opens in the guided quiz")}>Open bead finder</button>
          </div>
        </aside>

        <div>
          <div className="grid g3">
            {loading ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : list.map((p, i) => <ProductCard key={p.id} p={p} delay={(i % 3) * 60} />)}
          </div>
          {!loading && list.length === 0 && (
            <div style={{ textAlign: "center", padding: "70px 0" }}>
              {catalogue.length === 0 ? (
                <>
                  <h3>The catalogue could not be loaded</h3>
                  <p className="muted" style={{ margin: "8px 0 20px" }}>
                    Nothing is being shown rather than something out of date. Refresh in a moment.
                  </p>
                  <button className="btn btn-ghost" onClick={() => window.location.reload()}>Try again</button>
                </>
              ) : (
                <>
                  <h3>No pieces match these filters</h3>
                  <p className="muted" style={{ margin: "8px 0 20px" }}>Widen the price range or clear the mukhi selection.</p>
                  <button className="btn btn-ghost" onClick={() => { setMukhi([]); setMax(90000); setCat("All"); setOnlyStock(false); }}>Clear all filters</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* ============================ PRODUCT DETAIL ============================ */

function ProductPage({ product }: { product?: any }) {
  const S = useShop();
  const p = product ?? S.product;
  const [view, setView] = useState(0);
  const [tab, setTab] = useState("Description");
  const [zoom, setZoom] = useState(null);
  const [qty, setQty] = useState(1);
  const [pin, setPin] = useState("");
  const [eta, setEta] = useState(null);
  const [fbt, setFbt] = useState([true, true]);
  // Backs "related" and the frequently-bought-together strip when the product
  // payload does not carry its own related list.
  const [alsoLive, setAlsoLive] = useState<any[]>([]);
  const [writing, setWriting] = useState(false);
  const [myRating, setMyRating] = useState(5);
  const [myReview, setMyReview] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); setView(0); setTab("Description"); setQty(1); }, [p?.id]);

  useEffect(() => {
    let cancelled = false;
    api.products({ take: 24 }).then((r) => {
      if (!cancelled) setAlsoLive(normProducts(r?.items ?? []));
    });
    return () => { cancelled = true; };
  }, []);

  if (!p) return null;

  const off = Math.round(((p.mrp - p.price) / p.mrp) * 100);
  // The gallery is the uploaded photography when there is any; with none, it falls
  // back to the two drawn views so the layout never collapses on an unphotographed piece.
  const shots: any[] = p.images?.length ? p.images : [];
  const views = shots.length
    ? shots.map((m: any, i: number) => m.alt || `View ${i + 1}`)
    : ["Front", "Reverse", "360° view", "On-body video"];
  const pool = alsoLive.filter((x: any) => x.id !== p.id);
  const related = p.related?.length
    ? p.related
    : pool.filter((x: any) => x.category === p.category || x.tone === p.tone).slice(0, 4);
  // Pair with two in-stock items from other categories rather than fixed positions.
  const bundle = pool.filter((x: any) => x.category !== p.category && x.stock > 0).slice(0, 2);
  const bundleTotal = p.price + bundle.reduce((s: number, b: any, i: number) => s + (fbt[i] ? b.price : 0), 0);

  const onMove = (e) => {
    const r = boxRef.current.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  const reviews = (p.serverReviews?.length ? p.serverReviews : []).map((r: any) => ({
    n: r.author ?? "Verified buyer",
    d: new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    r: r.rating,
    t: r.body,
    v: r.verified,
  }));

  return (
    <main className="wrap" style={{ padding: "30px 24px 70px" }}>
      <div style={{ fontSize: ".76rem", color: "var(--ink-3)", marginBottom: 22 }}>
        <button onClick={() => S.go("home")}>Home</button> / <button onClick={() => S.go("shop")}>Shop</button> /{" "}
        <button onClick={() => S.go("shop", { cat: p.category })}>{p.category}</button> / <span style={{ color: "var(--ink)" }}>{p.name}</span>
      </div>

      <div className="grid pdp" style={{ gridTemplateColumns: "1.05fr .95fr", gap: 46, alignItems: "start" }}>
        {/* gallery */}
        <div style={{ position: "sticky", top: 100 }}>
          <div className="gallery-main" ref={boxRef} onMouseMove={onMove} onMouseLeave={() => setZoom(null)}>
            <div style={{
              position: "absolute", inset: "8%", transition: "transform .25s",
              transform: zoom ? `scale(1.9)` : "none",
              transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : "center",
            }}>
              <ProductArt src={shots[view]?.url} alt={shots[view]?.alt || p.name}
                kind={p.kind} tone={p.tone} mukhi={p.mukhi} id={`d${p.id}-${view}`} />
            </div>
            {!shots.length && view === 2 && (
              <div style={{ position: "absolute", left: 16, bottom: 16, display: "flex", gap: 8, alignItems: "center", background: "var(--surface)", padding: "8px 14px", borderRadius: 999, fontSize: ".74rem" }}>
                {I.cube} Drag to rotate
              </div>
            )}
            {!shots.length && view === 3 && (
              <button style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }} onClick={() => S.toast("Playing the on-body video")}>
                <span style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,.9)", display: "grid", placeItems: "center", color: "var(--brown)" }}>{I.play}</span>
              </button>
            )}
            <span style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 6, alignItems: "center", fontSize: ".7rem", color: "var(--ink-3)" }}>{I.zoom} Hover to zoom</span>
            {p.badge && <span className="tag gold">{p.badge}</span>}
          </div>
          <div className="thumbs">
            {views.map((v, i) => (
              <button key={v} className={`thumb ${view === i ? "on" : ""}`} onClick={() => setView(i)} title={v} aria-label={v}>
                {shots.length
                  ? <ProductArt src={shots[i]?.url} alt={shots[i]?.alt || p.name} kind={p.kind} tone={p.tone} mukhi={p.mukhi} id={`t${p.id}-${i}`} />
                  : i < 2 ? <Art kind={p.kind} tone={p.tone} mukhi={p.mukhi} id={`t${p.id}-${i}`} />
                    : <span style={{ display: "grid", placeItems: "center", height: "100%", fontSize: ".62rem", letterSpacing: ".1em", color: "var(--ink-3)", textAlign: "center", padding: 6 }}>{i === 2 ? "360°" : "VIDEO"}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* buy box */}
        <div>
          <span className="pc-cat">{p.category} · SKU DV-{1000 + p.id}</span>
          <h1 style={{ fontSize: "clamp(1.8rem,3.2vw,2.5rem)", margin: "10px 0 12px" }}>{p.name}</h1>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <Stars v={p.rating} n={p.reviews} />
            <span className="mukhi-pill">{I.shield} Lab certified</span>
            {p.stock > 0 ? <span className="pill ok">In stock · {p.stock} left</span> : <span className="pill bad">Sold out</span>}
          </div>

          <div className="price" style={{ margin: "22px 0 6px" }}>
            <b style={{ fontSize: "1.9rem", fontFamily: "var(--display)" }}>{money(p.price)}</b>
            <s>{money(p.mrp)}</s><i>{off}% off</i>
          </div>
          <p className="muted" style={{ fontSize: ".8rem" }}>Inclusive of all taxes · GST invoice provided</p>

          <div style={{ background: "var(--surface-2)", border: "1px dashed var(--gold-line)", borderRadius: 12, padding: "12px 16px", margin: "20px 0", fontSize: ".84rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span>Apply <b>SHRAVAN20</b> for an extra 20% off</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { S.applyCoupon("SHRAVAN20"); }}>Apply</button>
          </div>

          <p style={{ color: "var(--ink-2)" }}>{p.desc}</p>

          <div style={{ display: "flex", gap: 14, alignItems: "center", margin: "26px 0 18px" }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 999 }}>
              <button style={{ padding: "12px 16px" }} onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">−</button>
              <span style={{ minWidth: 22, textAlign: "center" }}>{qty}</span>
              <button style={{ padding: "12px 16px" }} onClick={() => setQty((q) => Math.min(p.stock, q + 1))} aria-label="Increase">+</button>
            </div>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={p.stock === 0} onClick={() => S.add(p, qty)}>Add to bag</button>
            <button className="icobtn" style={{ border: "1px solid var(--line)", width: 46, height: 46, color: S.wish.includes(p.id) ? "#C0392B" : undefined }}
              onClick={() => S.toggleWish(p.id)} aria-label="Save to wishlist">{I.heart(S.wish.includes(p.id))}</button>
          </div>
          <button className="btn btn-ghost btn-block" onClick={() => { S.add(p, qty); S.go("checkout"); }}>Buy it now</button>

          <div style={{ display: "flex", gap: 10, margin: "22px 0" }}>
            <input className="inp" placeholder="Delivery pincode" value={pin} maxLength={6}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setEta(null); }} />
            <button className="btn btn-ghost" onClick={() => setEta(pin.length === 6 ? "Arrives Fri, 14 Aug · Free insured shipping" : "Enter a 6-digit pincode")}>Check</button>
          </div>
          {eta && <p style={{ fontSize: ".84rem", color: eta.startsWith("Arrives") ? "#2E7D4F" : "#C0392B", marginTop: -8, marginBottom: 18 }}>{eta}</p>}

          <div className="grid g3" style={{ gap: 12, margin: "22px 0" }}>
            {([[I.shield, "Authenticity", "X-ray + lab report"], [I.truck, "Free shipping", "Over ₹2,999"], [I.leaf, "7-day returns", "No questions asked"]] as any[]).map(([ic, t, d]: any) => (
              <div key={t} style={{ border: "1px solid var(--line-2)", borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                <span style={{ color: "var(--saffron-deep)" }}>{ic}</span>
                <b style={{ display: "block", fontSize: ".82rem", marginTop: 6 }}>{t}</b>
                <span className="muted" style={{ fontSize: ".72rem" }}>{d}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: ".8rem", color: "var(--ink-3)" }}>
            Share:
            {["WhatsApp", "Copy link", "Email"].map((s) => (
              <button key={s} style={{ textDecoration: "underline", textUnderlineOffset: 3 }} onClick={() => S.toast(s === "Copy link" ? "Link copied to clipboard" : `Sharing via ${s}`)}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {/* frequently bought together — hidden until the catalogue gives us something to pair with */}
      {bundle.length > 0 && (
      <section style={{ marginTop: 70 }}>
        <h2 style={{ marginBottom: 20 }}>Frequently bought together</h2>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 16, padding: 24 }}>
          {[p, ...bundle].map((b, i) => (
            <React.Fragment key={b.id}>
              {i > 0 && <span style={{ fontSize: "1.3rem", color: "var(--ink-3)" }}>+</span>}
              <div style={{ width: 130 }}>
                <div style={{ borderRadius: 12, overflow: "hidden", background: "var(--surface-2)", aspectRatio: 1 }}>
                  <ProductArt src={b.image} alt={b.name} kind={b.kind} tone={b.tone} mukhi={b.mukhi} id={`f${b.id}`} />
                </div>
                <label style={{ display: "flex", gap: 7, alignItems: "flex-start", marginTop: 9, fontSize: ".78rem" }}>
                  <input type="checkbox" checked={i === 0 ? true : fbt[i - 1]} disabled={i === 0}
                    onChange={(e) => setFbt((f) => f.map((v, j) => (j === i - 1 ? e.target.checked : v)))} />
                  <span>{b.name}<br /><b>{money(b.price)}</b></span>
                </label>
              </div>
            </React.Fragment>
          ))}
          <div style={{ marginLeft: "auto" }}>
            <span className="muted" style={{ fontSize: ".78rem" }}>Bundle total</span>
            <div style={{ fontFamily: "var(--display)", fontSize: "1.6rem", margin: "4px 0 12px" }}>{money(bundleTotal)}</div>
            <button className="btn btn-primary" onClick={() => { S.add(p); bundle.forEach((b: any, i: number) => fbt[i] && S.add(b)); }}>Add selected to bag</button>
          </div>
        </div>
      </section>
      )}

      {/* tabs */}
      <section style={{ marginTop: 60 }}>
        <div className="tabs">
          {["Description", "Benefits", "How to wear", "Specifications", "Certificates", "Reviews", "Q&A", "Shipping & returns"].map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        <div style={{ padding: "30px 0", maxWidth: 820 }}>
          {tab === "Description" && (
            <>
              <p style={{ fontSize: "1.02rem", color: "var(--ink-2)" }}>{p.desc}</p>
              <p style={{ marginTop: 14, color: "var(--ink-2)" }}>
                Beads are matched by hand for diameter within ±0.3 mm, then knotted on a double-braided silk cord so a single break never scatters the mala. The guru bead carries a stamped hallmark you can verify against your certificate number.
              </p>
            </>
          )}
          {tab === "Benefits" && (
            <ul style={{ display: "grid", gap: 12, listStyle: "none" }}>
              {p.benefits.map((b) => (
                <li key={b} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ color: "var(--saffron)", marginTop: 3 }}>{I.check}</span><span>{b}</span>
                </li>
              ))}
              <li className="muted" style={{ fontSize: ".82rem", marginTop: 8 }}>
                Traditional and devotional context. Not a substitute for medical care.
              </li>
            </ul>
          )}
          {tab === "How to wear" && <p style={{ fontSize: "1.02rem", color: "var(--ink-2)" }}>{p.wear}</p>}
          {tab === "Specifications" && (
            <dl className="spec">
              {[["Material", p.material], ["Origin", p.origin], ["Mukhi", `${p.mukhi} face`], ["Weight", p.weight],
              ["Size", p.size], ["Certification", "IGI lab report + X-ray scan"], ["Care", p.care]].map(([k, v]) => (
                <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>
              ))}
            </dl>
          )}
          {tab === "Certificates" && (
            <div className="grid g2">
              {[["Authenticity certificate", "Issued by Divyaloka · signed by our sourcing head", "DV-CERT-" + (48210 + p.id)],
              ["Lab report", "IGI Varanasi · X-ray scan and mukhi verification", "IGI-" + (99120 + p.id)]].map(([t, d, n]) => (
                <div key={t} style={{ border: "1px solid var(--gold-line)", borderRadius: 14, padding: 22, background: "var(--surface)" }}>
                  <span style={{ color: "var(--gold)" }}>{I.shield}</span>
                  <h3 style={{ margin: "10px 0 6px" }}>{t}</h3>
                  <p className="muted" style={{ fontSize: ".86rem" }}>{d}</p>
                  <p style={{ fontFamily: "var(--display)", marginTop: 12 }}>{n}</p>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => S.toast("Downloading " + n + ".pdf")}>Download PDF</button>
                </div>
              ))}
            </div>
          )}
          {tab === "Reviews" && (
            <>
              <div style={{ display: "flex", gap: 40, flexWrap: "wrap", alignItems: "center", marginBottom: 28 }}>
                <div>
                  <div style={{ fontFamily: "var(--display)", fontSize: "3rem", lineHeight: 1 }}>{p.rating}</div>
                  <Stars v={p.rating} /><p className="muted" style={{ fontSize: ".8rem", marginTop: 4 }}>{p.reviews} verified reviews</p>
                </div>
                <div style={{ flex: 1, minWidth: 240, display: "grid", gap: 6 }}>
                  {[5, 4, 3, 2, 1].map((s, i) => (
                    <div key={s} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: ".78rem" }}>
                      <span style={{ width: 12 }}>{s}</span>
                      <div style={{ flex: 1, height: 6, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${[74, 18, 5, 2, 1][i]}%`, background: "var(--gold)" }} />
                      </div>
                      <span className="muted">{[74, 18, 5, 2, 1][i]}%</span>
                    </div>
                  ))}
                </div>
                <button className="btn btn-ghost" onClick={() => setWriting((w: boolean) => !w)}>
                  {writing ? "Close" : "Write a review"}
                </button>
              </div>
              {writing && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 20, marginBottom: 22 }}>
                  <div className="chips" style={{ marginBottom: 14 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} className={`chip ${myRating === n ? "on" : ""}`} onClick={() => setMyRating(n)}>{n} ★</button>
                    ))}
                  </div>
                  <textarea className="inp" value={myReview} onChange={(e) => setMyReview(e.target.value)}
                    placeholder="What did you notice when it arrived? Fit, finish, the certificate — whatever helps the next buyer." />
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={busy || myReview.length < 10}
                    onClick={async () => {
                      setBusy(true);
                      const res = await api.createReview({ productId: p.id, rating: myRating, body: myReview });
                      setBusy(false);
                      if (!res.ok) { S.toast(res.message!, true); return; }
                      setMyReview(""); setWriting(false);
                      S.toast("Thank you — your review is queued for moderation.");
                    }}>
                    {busy ? "Sending…" : "Publish review"}
                  </button>
                  <p className="muted" style={{ fontSize: ".76rem", marginTop: 10 }}>
                    Reviews are published only from confirmed orders, which is what keeps the rating worth reading.
                  </p>
                </div>
              )}

              {reviews.length === 0 && !writing && (
                <p className="muted">No published reviews yet. If you have bought this, yours would be the first.</p>
              )}

              <div style={{ display: "grid", gap: 18 }}>
                {reviews.map((r: any) => (
                  <div key={r.n} style={{ borderTop: "1px solid var(--line-2)", paddingTop: 18 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                      <span className="avatar" style={{ width: 34, height: 34 }}>{r.n[0]}</span>
                      <span><b style={{ fontSize: ".9rem" }}>{r.n}</b>{r.v && <span className="pill ok" style={{ marginLeft: 8 }}>Verified buyer</span>}
                        <br /><span className="muted" style={{ fontSize: ".74rem" }}>{r.d}</span></span>
                      <span style={{ marginLeft: "auto" }}><Stars v={r.r} /></span>
                    </div>
                    <p style={{ color: "var(--ink-2)" }}>{r.t}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "Q&A" && (
            <div style={{ display: "grid", gap: 18 }}>
              {[["Can I wear this while sleeping?", "Yes, though most sadhaks remove it to keep the cord dry from sweat. Rudraksha itself is unaffected."],
              ["Is it suitable for children?", "Panchmukhi is worn at any age. For a child, choose the 6 mm strand rather than 8 mm."],
              ["Do you ship internationally?", "To 41 countries with insured DHL. Customs duty is charged at destination."]].map(([q, a]) => (
                <div key={q} style={{ borderBottom: "1px solid var(--line-2)", paddingBottom: 16 }}>
                  <b style={{ fontFamily: "var(--display)", fontWeight: 500 }}>Q. {q}</b>
                  <p className="muted" style={{ marginTop: 6 }}>{a}</p>
                </div>
              ))}
              <div style={{ display: "flex", gap: 10 }}>
                <input className="inp" value={question} onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question about this product" />
                <button className="btn btn-ghost" disabled={busy || question.length < 5} onClick={async () => {
                  setBusy(true);
                  const res = await api.askQuestion(p.id, question);
                  setBusy(false);
                  if (!res.ok) { S.toast(res.message!, true); return; }
                  setQuestion("");
                  S.toast("Question sent. Answered within 24 hours.");
                }}>Ask</button>
              </div>
            </div>
          )}
          {tab === "Shipping & returns" && (
            <dl className="spec">
              <dt>Dispatch</dt><dd>Within 24 hours from Varanasi. Same-day for orders before 11am IST.</dd>
              <dt>Shipping</dt><dd>Free insured shipping above ₹2,999. Below that, ₹99 flat. International from ₹1,450.</dd>
              <dt>Returns</dt><dd>7 days from delivery, seal intact. Refund to source within 5 working days.</dd>
              <dt>Exchanges</dt><dd>Size exchanges on bracelets and clothing are free once per order.</dd>
              <dt>Not returnable</dt><dd>Energised custom malas and personalised gift boxes.</dd>
            </dl>
          )}
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <div className="sec-head"><div><span className="eyebrow">You may also like</span><h2>Related pieces</h2></div></div>
        <div className="grid g4">{related.map((r, i) => <ProductCard key={r.id} p={r} delay={i * 60} />)}</div>
      </section>

      {S.recent.length > 1 && (
        <section style={{ marginTop: 60 }}>
          <div className="sec-head"><div><span className="eyebrow">Your trail</span><h2>Recently viewed</h2></div></div>
          <div className="grid g5" style={{ gap: 14 }}>
            {S.recent.filter((r) => r.id !== p.id).slice(0, 5).map((r) => (
              <button key={r.id} onClick={() => S.openProduct(r)} style={{ textAlign: "left" }}>
                <div style={{ borderRadius: 12, overflow: "hidden", aspectRatio: 1, background: "var(--surface-2)" }}>
                  <ProductArt src={r.image} alt={r.name} kind={r.kind} tone={r.tone} mukhi={r.mukhi} id={`rv${r.id}`} />
                </div>
                <span style={{ fontSize: ".8rem", display: "block", marginTop: 8 }}>{r.name}</span>
                <b style={{ fontSize: ".84rem" }}>{money(r.price)}</b>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export { Home, ShopPage, ProductPage };
