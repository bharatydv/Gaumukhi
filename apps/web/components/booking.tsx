"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Art, ProductArt, I, LotusMark } from "./art";
import { money } from "../lib/format";
import { api } from "../lib/api";
import { normPuja, normPandit, normPost } from "../lib/normalise";
import { Shop, useShop, Reveal, Stars, ProductCard, SkeletonCard } from "./shell";


/* ============================ BOOK PUJA ============================ */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MUHURAT: Record<number, string> = { 6: "Amrit", 8: "Shubh", 11: "Amrit", 14: "Labh", 18: "Chal", 21: "Shubh" };
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

function BookPuja({ initialPujas = [], initialPandits = [] }: { initialPujas?: any[]; initialPandits?: any[] }) {
  const S = useShop();
  const [step, setStep] = useState(0);
  // Seeded from the server render so step one is populated on first paint, then
  // refreshed client-side as the shopper narrows by date, language and puja.
  const [pujas, setPujas] = useState<any[]>(initialPujas);
  const [pandits, setPandits] = useState<any[]>(initialPandits);
  const [loadingPandits, setLoadingPandits] = useState(false);

  const [puja, setPuja] = useState<any>(null);
  const [mode, setMode] = useState("OFFLINE");
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [pandit, setPandit] = useState<any>(null);
  const [lang, setLang] = useState("Hindi");

  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "Home", name: "", phone: "", line1: "", city: "", state: "Uttar Pradesh", pincode: "" });
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);

  const steps = ["Puja", "Mode & date", "Pandit", "Details", "Payment"];

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  // The puja catalogue is whatever the admin has published — no bundled copy.
  useEffect(() => {
    api.pujas().then((rows) => {
      const mapped = (rows ?? []).map(normPuja);
      setPujas(mapped);
      const wanted = S.params.puja;
      if (wanted) {
        const hit = mapped.find((p: any) => p.slug === wanted || p.id === wanted);
        if (hit) { setPuja(hit); setStep(1); }
      }
    });
    if (S.user) api.addresses().then((rows) => {
      setAddresses(rows ?? []);
      const def = (rows ?? []).find((a: any) => a.isDefault) ?? (rows ?? [])[0];
      if (def) setAddressId(def.id);
    });
  }, [S.params.puja, S.user]);

  // Pandits are filtered by the date and language actually chosen.
  useEffect(() => {
    if (step !== 2 || !date) return;
    setLoadingPandits(true);
    api.pandits({ date: dateKey(date), language: lang, pujaId: puja?.id })
      .then((rows) => {
        setPandits((rows ?? []).map(normPandit));
        setLoadingPandits(false);
      });
  }, [step, date, lang, puja?.id]);

  // The server quotes the price; we never compute a total the backend would disagree with.
  useEffect(() => {
    if (!puja) return;
    api.quote({ pujaId: puja.id, mode, panditId: pandit?.id, couponCode: code || undefined }).then((q) => {
      if (q) {
        setQuote({
          vidhiFee: q.vidhiFee / 100,
          dakshina: q.dakshina / 100,
          samagriFee: q.samagriFee / 100,
          discount: q.discount / 100,
          total: q.total / 100,
        });
      } else {
        const vidhi = puja.price ?? 0;
        const dak = pandit?.fee ?? 0;
        const sam = mode === "ONLINE" ? 0 : puja.samagri ?? 2400;
        setQuote({ vidhiFee: vidhi, dakshina: dak, samagriFee: sam, discount: 0, total: vidhi + dak + sam });
      }
    });
  }, [puja, mode, pandit?.id, code]);

  const days = useMemo(() => {
    const out: Array<{ d: Date; key: string; auspicious: boolean }> = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 1; i <= 28; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push({ d, key: d.toDateString(), auspicious: [1, 4, 0].includes(d.getDay()) });
    }
    return out;
  }, []);

  const needsAddress = mode !== "ONLINE";
  const detailsOk = needsAddress
    ? !!addressId || (form.name && form.phone && form.line1 && form.pincode.length === 6)
    : true;
  const canNext = [!!puja, !!date && !!slot, !!pandit, detailsOk][step];

  const submit = async () => {
    setBusy(true);
    let useAddress = addressId;

    if (needsAddress && !useAddress) {
      const saved = await api.addAddress(form);
      if (!saved.ok) { setBusy(false); S.toast(saved.message!, true); return; }
      useAddress = saved.data.id;
    }

    const booking = await S.createBooking({
      pujaId: puja.id,
      panditId: pandit?.id,
      mode,
      date: dateKey(date!),
      slot,
      language: lang,
      addressId: needsAddress ? useAddress : undefined,
      sankalpNotes: notes,
      attachments: files,
      couponCode: code || undefined,
    });

    setBusy(false);
    if (booking) setDone({ ...booking, puja, pandit, mode, date, slot, lang, total: quote?.total ?? 0 });
  };

  if (done) return (
    <main className="wrap" style={{ padding: "70px 24px 90px", maxWidth: 760 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 96, margin: "0 auto 20px" }}><Art kind="samagri" tone="gold" id="ok" /></div>
        <span className="eyebrow">Booking confirmed</span>
        <h1 style={{ fontSize: "2.4rem", margin: "12px 0 10px" }}>{done.puja.name} is booked</h1>
        <p className="muted">
          Reference <b style={{ color: "var(--ink)" }}>{done.reference}</b> · A confirmation has gone to your email, SMS and WhatsApp.
        </p>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, padding: 28, marginTop: 34 }}>
        <dl className="spec">
          <dt>Puja</dt><dd>{done.puja.name} · {done.puja.dur}</dd>
          <dt>Mode</dt><dd>{String(done.mode).toLowerCase()}{done.meetingUrl ? " · video link below" : ""}</dd>
          <dt>Date & time</dt>
          <dd>{done.date.toDateString()} at {done.slot} ({MUHURAT[parseInt(done.slot)] || "Shubh"} muhurat)</dd>
          <dt>Pandit</dt><dd>{done.pandit ? `${done.pandit.name} · ${done.pandit.veda} · ${done.lang}` : "Being assigned within 12 hours"}</dd>
          <dt>Amount paid</dt><dd><b>{money(done.total)}</b> · Razorpay</dd>
        </dl>

        <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
          {done.meetingUrl && <a className="btn btn-primary" href={done.meetingUrl} target="_blank" rel="noreferrer">Video link</a>}
          <button className="btn btn-ghost" onClick={() => S.go("account", { tab: "Puja bookings" })}>Manage booking</button>
          <button className="btn btn-ghost" onClick={() => S.go("puja")}>Book another</button>
        </div>
      </div>

      <div style={{ marginTop: 30, padding: 22, background: "var(--surface-2)", borderRadius: 16 }}>
        <b style={{ fontFamily: "var(--display)", fontWeight: 500 }}>What happens next</b>
        <ol style={{ margin: "12px 0 0 18px", display: "grid", gap: 8, fontSize: ".9rem", color: "var(--ink-2)" }}>
          <li>Your pandit calls within 12 hours to confirm the sankalp details.</li>
          <li>The samagri list is emailed. {done.mode === "ONLINE" ? "You arrange items locally, or we ship the kit." : "We bring everything listed."}</li>
          <li>Reschedule free up to 48 hours before. Full refund up to 7 days before.</li>
        </ol>
      </div>
    </main>
  );

  return (
    <main>
      <section style={{ background: "linear-gradient(120deg,var(--brown),#4A2C18 60%,#6A3F17)", color: "var(--cream)", padding: "48px 0 44px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -60, top: -60, width: 300, opacity: .13 }}><Art kind="yantra" tone="gold" id="pujahead" /></div>
        <div className="wrap" style={{ position: "relative" }}>
          <span className="eyebrow" style={{ color: "var(--gold-light)" }}>Puja booking</span>
          <h1 style={{ color: "#fff", fontSize: "clamp(2rem,4vw,3.2rem)", margin: "12px 0 12px" }}>Book a pandit in four minutes</h1>
          <p style={{ color: "rgba(251,246,236,.76)", maxWidth: "56ch" }}>
            Verified pandits across 14 states. Fixed fees, itemised samagri, and a recording of every online puja kept in your account for a year.
          </p>
        </div>
      </section>

      <div className="wrap" style={{ padding: "36px 24px 80px" }}>
        <div className="steps">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className="step-sep" />}
              <button className={`step ${i === step ? "on" : ""} ${i < step ? "done" : ""}`} onClick={() => i < step && setStep(i)}>
                <i>{i < step ? I.check : i + 1}</i>{s}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 340px", gap: 36, alignItems: "start" }}>
          <div>
            {step === 0 && (
              <>
                <h2 style={{ marginBottom: 6 }}>Which puja?</h2>
                <p className="muted" style={{ marginBottom: 24 }}>
                  Prices shown are the vidhi fee. Pandit dakshina and samagri are added transparently at the next steps.
                </p>
                <div className="grid g2">
                  {pujas.map((p: any) => (
                    <button key={p.id} onClick={() => { setPuja(p); setStep(1); }} style={{
                      textAlign: "left", padding: 20, borderRadius: 14,
                      border: `1px solid ${puja?.id === p.id ? "var(--saffron)" : "var(--line)"}`,
                      background: puja?.id === p.id ? "rgba(224,128,27,.07)" : "var(--surface)", transition: ".3s",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <b style={{ fontFamily: "var(--display)", fontSize: "1.06rem", fontWeight: 500 }}>{p.name}</b>
                        <b style={{ whiteSpace: "nowrap" }}>{p.price ? money(p.price) : "On request"}</b>
                      </div>
                      <p className="muted" style={{ fontSize: ".85rem", margin: "7px 0 12px" }}>{p.note}</p>
                      <span className="pc-cat">{p.dur} · {p.pandits} pandit{p.pandits > 1 ? "s" : ""}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 style={{ marginBottom: 6 }}>How and when?</h2>
                <p className="muted" style={{ marginBottom: 22 }}>
                  Dates marked with a dot are auspicious for {puja.name} per this month's panchang.
                </p>

                <div className="grid g3" style={{ marginBottom: 30 }}>
                  {[["ONLINE", "Online", "Live video, you set up at home", "No samagri charge"],
                  ["OFFLINE", "Offline", "Pandit travels to your address", "Samagri included"],
                  ["HYBRID", "Hybrid", "Pandit at temple, family joins on video", "Recording provided"]].map(([val, m, d, n]) => (
                    <button key={val} onClick={() => setMode(val)} style={{
                      textAlign: "left", padding: 18, borderRadius: 14,
                      border: `1px solid ${mode === val ? "var(--saffron)" : "var(--line)"}`,
                      background: mode === val ? "rgba(224,128,27,.07)" : "var(--surface)",
                    }}>
                      <b style={{ fontFamily: "var(--display)", fontWeight: 500 }}>{m}</b>
                      <p className="muted" style={{ fontSize: ".82rem", marginTop: 6 }}>{d}</p>
                      <span className="pill" style={{ marginTop: 10, display: "inline-block" }}>{n}</span>
                    </button>
                  ))}
                </div>

                <h3 style={{ marginBottom: 12 }}>Choose a date</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginBottom: 26 }}>
                  {DAYS.map((d) => <span key={d} className="pc-cat" style={{ textAlign: "center" }}>{d}</span>)}
                  {days.map(({ d, key, auspicious }) => (
                    <button key={key} onClick={() => { setDate(d); setSlot(null); setPandit(null); }} style={{
                      padding: "12px 0", borderRadius: 10,
                      border: `1px solid ${date?.toDateString() === key ? "var(--saffron)" : "var(--line-2)"}`,
                      background: date?.toDateString() === key ? "var(--saffron)" : "var(--surface)",
                      color: date?.toDateString() === key ? "#fff" : "inherit", position: "relative", fontSize: ".9rem",
                    }}>
                      {d.getDate()}
                      {auspicious && <span style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 4, background: date?.toDateString() === key ? "#fff" : "var(--gold)" }} />}
                    </button>
                  ))}
                </div>

                {date && (
                  <>
                    <h3 style={{ marginBottom: 12 }}>Choose a muhurat</h3>
                    <div className="chips">
                      {["06:30", "08:00", "11:00", "14:00", "18:00", "21:00"].map((t) => (
                        <button key={t} className={`chip ${slot === t ? "on" : ""}`} onClick={() => { setSlot(t); setPandit(null); }}>
                          {t} · {MUHURAT[parseInt(t)] || "Shubh"}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <h2 style={{ marginBottom: 6 }}>Choose your pandit</h2>
                <p className="muted" style={{ marginBottom: 22 }}>
                  Availability for {date?.toDateString()} at {slot}. Every profile is verified in person at their home temple.
                </p>

                <label className="field" style={{ maxWidth: 260 }}>
                  <span>Preferred language</span>
                  <select className="inp" value={lang} onChange={(e) => { setLang(e.target.value); setPandit(null); }}>
                    {["Hindi", "Sanskrit", "English", "Tamil", "Marathi", "Bhojpuri", "Awadhi"].map((l) => <option key={l}>{l}</option>)}
                  </select>
                </label>

                {loadingPandits ? (
                  <div style={{ display: "grid", gap: 14 }}>
                    {[0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 104, borderRadius: 16 }} />)}
                  </div>
                ) : pandits.length === 0 ? (
                  <div style={{ padding: "40px 0", textAlign: "center" }}>
                    <h3>No pandit is free at that muhurat</h3>
                    <p className="muted" style={{ margin: "8px 0 18px" }}>Try another time, or widen the language filter.</p>
                    <button className="btn btn-ghost" onClick={() => setStep(1)}>Pick a different time</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 14 }}>
                    {pandits.map((p: any) => {
                      const free = !p.slots?.length || p.slots.includes(slot);
                      return (
                        <button key={p.id} disabled={!free} onClick={() => setPandit(p)} style={{
                          display: "flex", gap: 18, textAlign: "left", padding: 18, borderRadius: 16,
                          border: `1px solid ${pandit?.id === p.id ? "var(--saffron)" : "var(--line)"}`,
                          background: pandit?.id === p.id ? "rgba(224,128,27,.07)" : "var(--surface)",
                          alignItems: "center", flexWrap: "wrap", opacity: free ? 1 : 0.5,
                        }}>
                          <span style={{ width: 62, height: 62, borderRadius: "50%", background: "linear-gradient(135deg,var(--sand),var(--gold-light))", display: "grid", placeItems: "center", fontFamily: "var(--display)", fontSize: "1.3rem", color: "var(--brown)", flexShrink: 0 }}>
                            {(p.name || "P").replace(/^(Pt\.|Acharya)\s*/, "")[0]}
                          </span>
                          <span style={{ flex: "1 1 240px" }}>
                            <b style={{ fontFamily: "var(--display)", fontSize: "1.06rem", fontWeight: 500 }}>{p.name}</b>
                            <span style={{ display: "block", fontSize: ".82rem", color: "var(--ink-3)", margin: "4px 0 8px" }}>
                              {p.city} · {p.exp} yrs · {p.veda} · {(p.langs || []).join(", ")}
                            </span>
                            <Stars v={p.rating} n={p.reviews} />
                          </span>
                          <span style={{ textAlign: "right" }}>
                            <b style={{ fontSize: "1.05rem" }}>{money(p.fee)}</b>
                            <span style={{ display: "block", fontSize: ".72rem", color: "var(--ink-3)" }}>dakshina</span>
                            <span className={`pill ${free ? "ok" : "bad"}`} style={{ marginTop: 8, display: "inline-block" }}>
                              {free ? `Free at ${slot}` : "Busy"}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <h2 style={{ marginBottom: 6 }}>{needsAddress ? "Where should the pandit come?" : "Sankalp details"}</h2>
                <p className="muted" style={{ marginBottom: 22 }}>
                  Gotra and names are read aloud during the sankalp, so spelling matters.
                </p>

                {needsAddress && addresses.length > 0 && (
                  <div className="grid g2" style={{ marginBottom: 20 }}>
                    {addresses.map((a: any) => (
                      <button key={a.id} onClick={() => setAddressId(a.id)} style={{
                        textAlign: "left", padding: 16, borderRadius: 14,
                        border: `1px solid ${addressId === a.id ? "var(--saffron)" : "var(--line)"}`,
                        background: addressId === a.id ? "rgba(224,128,27,.07)" : "var(--surface)",
                      }}>
                        <b>{a.label}</b>
                        <p className="muted" style={{ fontSize: ".84rem", marginTop: 6 }}>
                          {a.name} · {a.phone}<br />{a.line1}, {a.city} {a.pincode}
                        </p>
                      </button>
                    ))}
                    <button onClick={() => setAddressId(null)} style={{
                      padding: 16, borderRadius: 14, border: `1px dashed ${addressId ? "var(--line)" : "var(--saffron)"}`,
                      background: "var(--surface)", fontSize: ".88rem",
                    }}>+ Use a different address</button>
                  </div>
                )}

                {needsAddress && !addressId && (
                  <>
                    <div className="grid g2" style={{ gap: 0, columnGap: 18 }}>
                      <label className="field"><span>Full name (as read in sankalp)</span>
                        <input className="inp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                      <label className="field"><span>Phone / WhatsApp</span>
                        <input className="inp" value={form.phone} maxLength={10}
                          onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} /></label>
                    </div>
                    <label className="field"><span>Address</span>
                      <input className="inp" value={form.line1} placeholder="House, street, landmark"
                        onChange={(e) => setForm({ ...form, line1: e.target.value })} /></label>
                    <div className="grid g2" style={{ gap: 0, columnGap: 18 }}>
                      <label className="field"><span>City</span>
                        <input className="inp" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
                      <label className="field"><span>Pincode</span>
                        <input className="inp" maxLength={6} value={form.pincode}
                          onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "") })} /></label>
                    </div>
                  </>
                )}

                <label className="field"><span>Special instructions</span>
                  <textarea className="inp" value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Gotra, family names, any specific sankalp, parking or lift details" /></label>

                <label className="field"><span>Reference photos or video (optional)</span>
                  <div style={{ border: "1px dashed var(--line)", borderRadius: 14, padding: 22, textAlign: "center" }}>
                    <p className="muted" style={{ fontSize: ".86rem" }}>Photos of the puja space, or a walk-through of the venue.</p>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}
                      onClick={() => setFiles((f) => [...f, `venue-${f.length + 1}.jpg`])}>Attach a file</button>
                    {files.length > 0 && <p style={{ fontSize: ".8rem", marginTop: 10, color: "#2E7D4F" }}>{files.join(", ")} attached</p>}
                  </div>
                </label>
              </>
            )}

            {step === 4 && (
              <>
                <h2 style={{ marginBottom: 6 }}>Payment</h2>
                <p className="muted" style={{ marginBottom: 22 }}>
                  Paying holds the muhurat. Until then the slot is reserved for 15 minutes only.
                </p>

                <div style={{ display: "grid", gap: 12 }}>
                  {[["UPI", "GPay, PhonePe, Paytm · instant"], ["Card", "Visa, Mastercard, Rupay · Razorpay secured"],
                  ["Net banking", "58 banks supported"]].map(([m, d], i) => (
                    <label key={m} style={{ display: "flex", gap: 14, alignItems: "center", padding: 16, border: "1px solid var(--line)", borderRadius: 13, background: "var(--surface)", cursor: "pointer" }}>
                      <input type="radio" name="pay" defaultChecked={i === 0} />
                      <span><b>{m}</b><br /><span className="muted" style={{ fontSize: ".8rem" }}>{d}</span></span>
                    </label>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                  <input className="inp" placeholder="Coupon code" value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())} />
                  <button className="btn btn-ghost" onClick={() => {
                    if (!code) { S.toast("Enter a coupon code first", true); return; }
                    S.toast(quote?.discount ? `${code} applied` : "Checking that code…");
                  }}>Apply</button>
                </div>

                <p className="muted" style={{ fontSize: ".78rem", marginTop: 20, display: "flex", gap: 8, alignItems: "center" }}>
                  {I.shield} Payments processed by Razorpay. Divyaloka never stores your card details.
                </p>
              </>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 34 }}>
              {step > 0 && <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>Back</button>}
              {step < 4 ? (
                <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                  Continue {I.chev}
                </button>
              ) : (
                <button className="btn btn-primary" disabled={busy} onClick={submit}>
                  {busy ? "Holding your muhurat…" : `Pay ${money(quote?.total ?? 0)} and confirm`}
                </button>
              )}
            </div>
          </div>

          <aside style={{ position: "sticky", top: 100, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>Booking summary</h3>
            {!puja ? (
              <p className="muted" style={{ fontSize: ".88rem" }}>
                Pick a puja to see the itemised cost. Nothing is charged until the last step.
              </p>
            ) : (
              <>
                <div style={{ display: "grid", gap: 10, fontSize: ".88rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Vidhi</span><span>{puja.name}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Mode</span><span>{mode.toLowerCase()}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Date</span><span>{date ? date.toDateString().slice(4) : "—"}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Time</span><span>{slot || "—"}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Pandit</span><span style={{ textAlign: "right" }}>{pandit ? pandit.name : "—"}</span></div>
                </div>

                <div style={{ borderTop: "1px solid var(--line-2)", margin: "18px 0", paddingTop: 18, display: "grid", gap: 9, fontSize: ".88rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Vidhi fee</span><span>{money(quote?.vidhiFee ?? 0)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Pandit dakshina</span><span>{quote?.dakshina ? money(quote.dakshina) : "—"}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Samagri kit</span><span>{quote?.samagriFee ? money(quote.samagriFee) : "Not required"}</span></div>
                  {quote?.discount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#2E7D4F" }}><span>{code}</span><span>−{money(quote.discount)}</span></div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                  <b>Total</b><b style={{ fontFamily: "var(--display)", fontSize: "1.5rem" }}>{money(quote?.total ?? 0)}</b>
                </div>
                <p className="muted" style={{ fontSize: ".74rem", marginTop: 12 }}>
                  Free reschedule up to 48 hrs before. Full refund up to 7 days before.
                </p>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

/* ============================ CHECKOUT ============================ */

function Checkout() {
  const S = useShop();
  const [step, setStep] = useState(0);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "Home", name: "", phone: "", line1: "", city: "", state: "Uttar Pradesh", pincode: "" });
  const [code, setCode] = useState("");
  const [usePoints, setUsePoints] = useState(0);
  const [placed, setPlaced] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!S.user) return;
    api.addresses().then((rows) => {
      setAddresses(rows ?? []);
      const def = (rows ?? []).find((a: any) => a.isDefault) ?? (rows ?? [])[0];
      if (def) setSelected(def.id);
      if ((rows ?? []).length === 0) setAdding(true);
    });
  }, [S.user]);

  const t = S.totals;
  const subtotal = t?.subtotal ?? S.subtotal;
  const discount = t?.discount ?? S.discount;
  const wrapFee = t?.giftWrapFee ?? (S.giftWrap ? 149 : 0);
  const ship = t?.shippingFee ?? (subtotal >= 2999 ? 0 : 99);
  const gst = t?.tax ?? Math.round((subtotal - discount) * 0.03);
  const points = Math.min(usePoints, S.user?.points ?? 0);
  const total = (t?.total ?? subtotal - discount + wrapFee + ship) - points;

  const saveAddress = async () => {
    if (!form.name || !form.phone || !form.line1 || form.pincode.length !== 6) {
      S.toast("Fill in name, phone, address and a 6-digit pincode", true);
      return;
    }
    setBusy(true);
    const res = await api.addAddress(form);
    setBusy(false);
    if (!res.ok) { S.toast(res.message!, true); return; }

    const rows = await api.addresses();
    setAddresses(rows ?? []);
    setSelected(res.data.id);
    setAdding(false);
    S.toast("Address saved");
  };

  if (placed) return (
    <main className="wrap" style={{ padding: "70px 24px 90px", maxWidth: 700, textAlign: "center" }}>
      <div style={{ width: 92, margin: "0 auto 18px" }}><Art kind="gift" tone="gold" id="ordered" /></div>
      <span className="eyebrow">Order placed</span>
      <h1 style={{ fontSize: "2.3rem", margin: "12px 0 10px" }}>Thank you, {(placed.name || "sadhak").split(" ")[0]}</h1>
      <p className="muted">
        Order <b style={{ color: "var(--ink)" }}>{placed.number}</b> · Dispatching from Varanasi within 24 hours.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => S.go("account", { tab: "Orders" })}>Track order</button>
        <button className="btn btn-ghost" onClick={async () => {
          const full = await api.order(placed.number);
          S.toast(full?.invoice?.number ? `Invoice ${full.invoice.number} ready` : "Invoice is being generated");
        }}>Get invoice</button>
        <button className="btn btn-ghost" onClick={() => S.go("shop")}>Continue shopping</button>
      </div>
    </main>
  );

  if (S.cart.length === 0) return (
    <main className="wrap" style={{ padding: "80px 24px", textAlign: "center" }}>
      <h2>Your bag is empty</h2>
      <p className="muted" style={{ margin: "10px 0 24px" }}>Add a piece before checking out.</p>
      <button className="btn btn-primary" onClick={() => S.go("shop")}>Browse the store</button>
    </main>
  );

  if (!S.user) return (
    <main className="wrap" style={{ padding: "80px 24px", textAlign: "center", maxWidth: 520 }}>
      <h2>Sign in to check out</h2>
      <p className="muted" style={{ margin: "10px 0 24px" }}>
        Your bag is saved. Signing in lets us attach the order, invoice and tracking to your account.
      </p>
      <button className="btn btn-primary" onClick={() => S.go("login")}>Sign in or create an account</button>
    </main>
  );

  return (
    <main className="wrap" style={{ padding: "34px 24px 80px" }}>
      <div className="steps">
        {["Address", "Delivery", "Payment"].map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <span className="step-sep" />}
            <span className={`step ${i === step ? "on" : ""} ${i < step ? "done" : ""}`}>
              <i>{i < step ? I.check : i + 1}</i>{s}
            </span>
          </React.Fragment>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 360px", gap: 36, alignItems: "start" }}>
        <div>
          {step === 0 && (
            <>
              <h2 style={{ marginBottom: 18 }}>Delivery address</h2>

              {addresses.length > 0 && !adding && (
                <div className="grid g2" style={{ marginBottom: 20 }}>
                  {addresses.map((a) => (
                    <button key={a.id} onClick={() => setSelected(a.id)} style={{
                      textAlign: "left", padding: 18, borderRadius: 14,
                      border: `1px solid ${selected === a.id ? "var(--saffron)" : "var(--line)"}`,
                      background: selected === a.id ? "rgba(224,128,27,.07)" : "var(--surface)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <b>{a.label}</b>{a.isDefault && <span className="pill ok">Default</span>}
                      </div>
                      <p className="muted" style={{ fontSize: ".85rem", marginTop: 8 }}>
                        {a.name} · {a.phone}<br />{a.line1}, {a.city}, {a.state} {a.pincode}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {adding ? (
                <>
                  <div className="grid g2" style={{ gap: 0, columnGap: 18 }}>
                    <label className="field"><span>Full name</span>
                      <input className="inp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                    <label className="field"><span>Phone</span>
                      <input className="inp" value={form.phone} maxLength={10}
                        onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} /></label>
                  </div>
                  <label className="field"><span>Address</span>
                    <input className="inp" value={form.line1} placeholder="Flat, building, street"
                      onChange={(e) => setForm({ ...form, line1: e.target.value })} /></label>
                  <div className="grid g3" style={{ gap: 0, columnGap: 18 }}>
                    <label className="field"><span>City</span>
                      <input className="inp" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
                    <label className="field"><span>State</span>
                      <select className="inp" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                        {["Uttar Pradesh", "Delhi", "Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat", "West Bengal", "Rajasthan", "Kerala"].map((s) => <option key={s}>{s}</option>)}
                      </select></label>
                    <label className="field"><span>Pincode</span>
                      <input className="inp" maxLength={6} value={form.pincode}
                        onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "") })} /></label>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button className="btn btn-primary" disabled={busy} onClick={saveAddress}>
                      {busy ? "Saving…" : "Save address"}
                    </button>
                    {addresses.length > 0 && <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>}
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", gap: 12 }}>
                  <button className="btn btn-ghost" onClick={() => setAdding(true)}>Add a new address</button>
                  <button className="btn btn-primary" disabled={!selected} onClick={() => setStep(1)}>Continue to delivery</button>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <h2 style={{ marginBottom: 18 }}>Delivery</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {[["Standard", "4–6 days · insured", ship === 0 ? "Free" : money(99)],
                ["Express", "2 days · Blue Dart Apex", money(249)],
                ["Same-day (Varanasi & Lucknow)", "Ordered before 11am", money(399)]].map(([tl, d, pr], i) => (
                  <label key={tl as string} style={{ display: "flex", gap: 14, alignItems: "center", padding: 16, border: "1px solid var(--line)", borderRadius: 13, background: "var(--surface)", cursor: "pointer" }}>
                    <input type="radio" name="ship" defaultChecked={i === 0} />
                    <span style={{ flex: 1 }}><b>{tl}</b><br /><span className="muted" style={{ fontSize: ".8rem" }}>{d}</span></span>
                    <b>{pr}</b>
                  </label>
                ))}
              </div>
              <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 20, fontSize: ".88rem" }}>
                <input type="checkbox" checked={S.giftWrap} onChange={(e) => S.setGiftWrap(e.target.checked)} />
                Add hand-tied gift wrap and a sankalp card (+₹149)
              </label>
              <div style={{ display: "flex", gap: 12, marginTop: 26 }}>
                <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
                <button className="btn btn-primary" onClick={() => setStep(2)}>Continue to payment</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={{ marginBottom: 18 }}>Payment</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {[["UPI", "GPay · PhonePe · Paytm"], ["Card", "Visa · Mastercard · Rupay"],
                ["Net banking", "58 banks"], ["Cash on delivery", "₹49 handling · orders under ₹10,000"]].map(([m, d], i) => (
                  <label key={m as string} style={{ display: "flex", gap: 14, alignItems: "center", padding: 16, border: "1px solid var(--line)", borderRadius: 13, background: "var(--surface)", cursor: "pointer" }}>
                    <input type="radio" name="pay2" defaultChecked={i === 0} />
                    <span><b>{m}</b><br /><span className="muted" style={{ fontSize: ".8rem" }}>{d}</span></span>
                  </label>
                ))}
              </div>

              {(S.user?.points ?? 0) > 0 && (
                <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 20, fontSize: ".88rem" }}>
                  <input type="checkbox" checked={usePoints > 0}
                    onChange={(e) => setUsePoints(e.target.checked ? Math.min(S.user.points, Math.floor(subtotal - discount)) : 0)} />
                  Redeem {S.user.points} reward points (₹{S.user.points})
                </label>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 26 }}>
                <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
                <button className="btn btn-primary" disabled={busy || !selected}
                  onClick={async () => {
                    setBusy(true);
                    const order = await S.placeOrder(selected, points * 100);
                    setBusy(false);
                    if (order) setPlaced({ ...order, name: S.userName });
                  }}>
                  {busy ? "Processing payment…" : `Pay ${money(total)}`}
                </button>
              </div>

              <p className="muted" style={{ fontSize: ".78rem", marginTop: 18, display: "flex", gap: 8, alignItems: "center" }}>
                {I.shield} Payments are processed by Razorpay. Divyaloka never stores your card details.
              </p>
            </>
          )}
        </div>

        <aside style={{ position: "sticky", top: 100, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, padding: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Order summary</h3>
          <div style={{ display: "grid", gap: 12, maxHeight: 240, overflowY: "auto" }}>
            {S.cart.map((l: any) => (
              <div key={l.key} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ width: 46, height: 46, borderRadius: 9, overflow: "hidden", background: "var(--surface-2)", flexShrink: 0 }}>
                  <ProductArt src={l.image} alt={l.name} kind={l.kind} tone={l.tone} mukhi={l.mukhi} id={`co${l.key}`} />
                </span>
                <span style={{ flex: 1, fontSize: ".84rem" }}>{l.name} <span className="muted">× {l.qty}</span></span>
                <b style={{ fontSize: ".86rem" }}>{money(l.price * l.qty)}</b>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, margin: "18px 0" }}>
            <input className="inp" placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            {S.coupon
              ? <button className="btn btn-ghost btn-sm" onClick={() => { S.removeCoupon(); setCode(""); }}>Remove</button>
              : <button className="btn btn-ghost btn-sm" onClick={() => S.applyCoupon(code)}>Apply</button>}
          </div>

          <div style={{ display: "grid", gap: 8, fontSize: ".88rem", borderTop: "1px solid var(--line-2)", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Subtotal</span><span>{money(subtotal)}</span></div>
            {discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#2E7D4F" }}><span>{S.coupon}</span><span>−{money(discount)}</span></div>}
            {wrapFee > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Gift wrap</span><span>{money(wrapFee)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">Shipping</span><span>{ship === 0 ? "Free" : money(ship)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span className="muted">GST (included)</span><span>{money(gst)}</span></div>
            {points > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#2E7D4F" }}><span>Reward points</span><span>−{money(points)}</span></div>}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 14 }}>
            <b>Total</b><b style={{ fontFamily: "var(--display)", fontSize: "1.5rem" }}>{money(total)}</b>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ============================ AUTH ============================ */

function Login() {
  const S = useShop();
  const [mode, setMode] = useState("otp");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<any>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  return (
    <main className="wrap" style={{ padding: "60px 24px 90px", maxWidth: 460 }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <LotusMark size={48} />
        <h1 style={{ fontSize: "2rem", margin: "14px 0 8px" }}>Welcome back</h1>
        <p className="muted">Sign in to track orders, bookings and reward points.</p>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, padding: 28 }}>
        <button className="btn btn-ghost btn-block" disabled={busy} style={{ marginBottom: 12 }}
          onClick={() => run(() => S.loginGoogle(`dev:${email || "aarav@example.com"}`))}>
          <span style={{ fontFamily: "var(--display)", fontWeight: 600 }}>G</span> Continue with Google
        </button>

        <div className="divider" style={{ margin: "18px 0", fontSize: ".74rem", letterSpacing: ".2em", textTransform: "uppercase" }}>or</div>

        <div className="chips" style={{ marginBottom: 18 }}>
          <button className={`chip ${mode === "otp" ? "on" : ""}`} onClick={() => setMode("otp")}>Phone OTP</button>
          <button className={`chip ${mode === "email" ? "on" : ""}`} onClick={() => setMode("email")}>Email</button>
        </div>

        {mode === "otp" ? (
          <>
            <label className="field"><span>Mobile number</span>
              <input className="inp" value={phone} maxLength={10} inputMode="numeric"
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="10-digit number" />
            </label>

            {sent && (
              <label className="field"><span>Enter the 6-digit code</span>
                <input className="inp" value={otp} maxLength={6} inputMode="numeric" style={{ letterSpacing: ".4em" }}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="••••••"
                  onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && run(() => S.verifyOtp(phone, otp))} />
              </label>
            )}

            {devCode && (
              <p style={{ fontSize: ".78rem", color: "var(--saffron-deep)", marginTop: -8, marginBottom: 14 }}>
                Development mode — your code is <b>{devCode}</b>. Live builds send this by SMS only.
              </p>
            )}

            <button className="btn btn-primary btn-block" disabled={busy || (sent ? otp.length !== 6 : phone.length !== 10)}
              onClick={() => run(async () => {
                if (!sent) {
                  const res = await S.requestOtp(phone);
                  if (res) { setSent(true); setDevCode(res.devCode ?? null); }
                } else {
                  await S.verifyOtp(phone, otp);
                }
              })}>
              {busy ? "Working…" : sent ? "Verify and sign in" : "Send OTP"}
            </button>

            {sent && (
              <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10 }} disabled={busy}
                onClick={() => run(async () => { const r = await S.requestOtp(phone); if (r) setDevCode(r.devCode ?? null); })}>
                Resend code
              </button>
            )}
          </>
        ) : (
          <>
            <label className="field"><span>Email</span>
              <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            </label>
            <label className="field"><span>Password</span>
              <input className="inp" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••"
                onKeyDown={(e) => e.key === "Enter" && run(() => S.loginEmail(email, pw))} />
            </label>
            <button className="btn btn-primary btn-block" disabled={busy || !email || pw.length < 6}
              onClick={() => run(() => S.loginEmail(email, pw))}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </>
        )}

        <p className="muted" style={{ fontSize: ".76rem", textAlign: "center", marginTop: 16 }}>
          New here? An account is created automatically on first sign-in.
        </p>

        {!S.online && (
          <p style={{ fontSize: ".76rem", textAlign: "center", marginTop: 14, color: "#C0392B" }}>
            The API is not reachable, so sign-in will not work until it is running.
          </p>
        )}
      </div>
    </main>
  );
}

/* ============================ ACCOUNT ============================ */

function Account() {
  const S = useShop();
  const tabs = ["Overview", "Orders", "Puja bookings", "Wishlist", "Addresses", "Reward points", "Refer & earn", "Support"];
  const [tab, setTab] = useState(S.params.tab && tabs.includes(S.params.tab) ? S.params.tab : "Overview");

  const [wishlist, setWishlist] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [points, setPoints] = useState<any>(null);
  const [referrals, setReferrals] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticket, setTicket] = useState({ category: "Order issue", subject: "", body: "" });
  const [tracking, setTracking] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (S.params.tab && tabs.includes(S.params.tab)) setTab(S.params.tab); }, [S.params.tab]);

  // Each tab loads only what it needs, when it is opened.
  useEffect(() => {
    if (!S.user) return;
    if (tab === "Wishlist") api.wishlist().then((r) => setWishlist(S.normProducts(r ?? [])));
    if (tab === "Addresses") api.addresses().then((r) => setAddresses(r ?? []));
    if (tab === "Reward points") api.points().then(setPoints);
    if (tab === "Refer & earn") api.referrals().then(setReferrals);
    if (tab === "Support") api.tickets().then((r) => setTickets(r ?? []));
  }, [tab, S.user]);

  if (!S.user) return (
    <main className="wrap" style={{ padding: "80px 24px", textAlign: "center", maxWidth: 520 }}>
      <h2>Sign in to see your account</h2>
      <p className="muted" style={{ margin: "10px 0 24px" }}>Orders, bookings, points and saved addresses all live behind sign-in.</p>
      <button className="btn btn-primary" onClick={() => S.go("login")}>Sign in</button>
    </main>
  );

  const orders = S.orders;
  const bookings = S.bookings;
  const nextBooking = bookings.find((b: any) => new Date(b.date) > new Date());

  return (
    <main className="wrap" style={{ padding: "36px 24px 80px" }}>
      <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 30, flexWrap: "wrap" }}>
        <span className="avatar" style={{ width: 60, height: 60, fontSize: "1.4rem" }}>{(S.userName || "S")[0]}</span>
        <div>
          <h1 style={{ fontSize: "1.9rem" }}>{S.userName}</h1>
          <p className="muted" style={{ fontSize: ".86rem" }}>
            Member since {new Date(S.user.createdAt ?? Date.now()).getFullYear()} · {S.user.points ?? 0} reward points
            {S.user.tier ? ` · ${S.user.tier} tier` : ""}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => S.logout()}>Sign out</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "220px 1fr", gap: 34, alignItems: "start" }}>
        <aside style={{ position: "sticky", top: 100, display: "grid", gap: 2 }}>
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              textAlign: "left", padding: "10px 14px", borderRadius: 10, fontSize: ".9rem",
              background: tab === t ? "var(--surface-2)" : "transparent",
              color: tab === t ? "var(--ink)" : "var(--ink-2)", fontWeight: tab === t ? 500 : 400,
            }}>{t}</button>
          ))}
        </aside>

        <div>
          {tab === "Overview" && (
            <>
              <div className="grid g3" style={{ marginBottom: 30 }}>
                {[["Orders", orders.length, "lifetime"],
                ["Puja bookings", bookings.length, "completed & upcoming"],
                ["Reward points", S.user.points ?? 0, `worth ${money(S.user.points ?? 0)}`]].map(([t, v, d]) => (
                  <div key={t as string} className="kpi">
                    <span className="pc-cat">{t}</span><b>{v}</b>
                    <span className="muted" style={{ fontSize: ".78rem" }}>{d}</span>
                  </div>
                ))}
              </div>

              <h3 style={{ marginBottom: 14 }}>Next up</h3>
              {nextBooking ? (
                <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: 22, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ width: 54, height: 54, borderRadius: 12, background: "var(--surface-2)", display: "grid", placeItems: "center", color: "var(--saffron-deep)" }}>{I.cal}</span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <b style={{ fontFamily: "var(--display)", fontWeight: 500 }}>{nextBooking.puja.name} · {nextBooking.mode}</b>
                    <p className="muted" style={{ fontSize: ".84rem" }}>
                      {new Date(nextBooking.date).toDateString().slice(0, 10)} at {nextBooking.slot}
                      {nextBooking.pandit ? ` · ${nextBooking.pandit.name}` : " · pandit being assigned"}
                    </p>
                  </div>
                  {nextBooking.meetingUrl && (
                    <a className="btn btn-ghost btn-sm" href={nextBooking.meetingUrl} target="_blank" rel="noreferrer">Join link</a>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => setTab("Puja bookings")}>Manage</button>
                </div>
              ) : (
                <p className="muted">No upcoming bookings. <button className="link-more" onClick={() => S.go("puja")}>Book a puja</button></p>
              )}
            </>
          )}

          {tab === "Orders" && (
            <>
              <h2 style={{ marginBottom: 18 }}>Orders</h2>
              {orders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 0" }}>
                  <p className="muted" style={{ marginBottom: 18 }}>No orders yet.</p>
                  <button className="btn btn-primary" onClick={() => S.go("shop")}>Browse the store</button>
                </div>
              ) : (
                <>
                  <table className="tbl">
                    <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {orders.map((o: any) => (
                        <tr key={o.number}>
                          <td><b>{o.number}</b></td>
                          <td>{o.date}</td>
                          <td>{o.items}</td>
                          <td>{money(o.total)}</td>
                          <td><span className={`pill ${o.status === "Delivered" ? "ok" : o.status.includes("Cancel") ? "bad" : "warn"}`}>{o.status}</span></td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button className="btn btn-ghost btn-sm" onClick={async () => setTracking(await api.track(o.number))}>Track</button>{" "}
                            {o.status === "Delivered" && (
                              <button className="btn btn-ghost btn-sm" onClick={async () => {
                                const res = await api.requestReturn(o.number, "Not as expected");
                                S.toast(res.ok ? res.data.message : res.message!, !res.ok);
                                if (res.ok) S.refreshAccount();
                              }}>Return</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {tracking && (
                    <div style={{ marginTop: 26, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: 22 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <b style={{ fontFamily: "var(--display)", fontWeight: 500 }}>{tracking.number}</b>
                        <button className="icobtn" onClick={() => setTracking(null)} aria-label="Close tracking">{I.x}</button>
                      </div>
                      {tracking.awb && <p className="muted" style={{ fontSize: ".82rem", marginBottom: 14 }}>{tracking.carrier} · AWB {tracking.awb}</p>}
                      <div style={{ display: "grid", gap: 12 }}>
                        {tracking.steps.map((s: any) => (
                          <div key={s.key} style={{ display: "flex", gap: 12, alignItems: "center", opacity: s.done ? 1 : 0.45 }}>
                            <span style={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", background: s.done ? "var(--saffron)" : "var(--surface-2)", color: "#fff" }}>
                              {s.done ? I.check : ""}
                            </span>
                            <span style={{ flex: 1, fontSize: ".88rem" }}>{s.label}</span>
                            <span className="muted" style={{ fontSize: ".76rem" }}>
                              {s.at ? new Date(s.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {tab === "Puja bookings" && (
            <>
              <h2 style={{ marginBottom: 18 }}>Puja bookings</h2>
              {bookings.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 0" }}>
                  <p className="muted" style={{ marginBottom: 18 }}>No bookings yet.</p>
                  <button className="btn btn-primary" onClick={() => S.go("puja")}>Book a puja</button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {bookings.map((b: any) => (
                    <div key={b.reference} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: 20, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <span className="pc-cat">{b.reference}</span>
                        <b style={{ display: "block", fontFamily: "var(--display)", fontSize: "1.05rem", fontWeight: 500, margin: "4px 0" }}>
                          {b.puja.name} · {b.mode}
                        </b>
                        <span className="muted" style={{ fontSize: ".84rem" }}>
                          {new Date(b.date).toDateString().slice(4)} at {b.slot}
                          {b.pandit ? ` · ${b.pandit.name}` : " · pandit being assigned"}
                        </span>
                      </div>
                      <b>{money(b.total)}</b>
                      <span className={`pill ${b.statusLabel === "Confirmed" || b.statusLabel === "Completed" ? "ok" : b.statusLabel === "Cancelled" ? "bad" : "warn"}`}>
                        {b.statusLabel}
                      </span>
                      {b.meetingUrl && <a className="btn btn-ghost btn-sm" href={b.meetingUrl} target="_blank" rel="noreferrer">Join</a>}
                      {!["Cancelled", "Completed"].includes(b.statusLabel) && (
                        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => {
                          setBusy(true);
                          await S.cancelBooking(b.reference, "Cancelled by customer");
                          setBusy(false);
                        }}>Cancel</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "Wishlist" && (
            <>
              <h2 style={{ marginBottom: 18 }}>Wishlist</h2>
              {wishlist.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 0" }}>
                  <p className="muted" style={{ marginBottom: 18 }}>Nothing saved yet. Tap the heart on any piece to keep it here.</p>
                  <button className="btn btn-primary" onClick={() => S.go("shop")}>Browse the store</button>
                </div>
              ) : (
                <>
                  <div className="grid g3">{wishlist.map((p: any) => <ProductCard key={p.id} p={p} />)}</div>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 20 }}
                    onClick={() => {
                      const url = `${window.location.origin}/shop?wishlist=${S.user.referralCode}`;
                      navigator.clipboard?.writeText(url);
                      S.toast("Shareable wishlist link copied");
                    }}>Share wishlist</button>
                </>
              )}
            </>
          )}

          {tab === "Addresses" && (
            <>
              <h2 style={{ marginBottom: 18 }}>Saved addresses</h2>
              <div className="grid g2">
                {addresses.map((a: any) => (
                  <div key={a.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 20, background: "var(--surface)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <b>{a.label}</b>{a.isDefault && <span className="pill ok">Default</span>}
                    </div>
                    <p className="muted" style={{ fontSize: ".86rem", marginTop: 8 }}>
                      {a.name} · {a.phone}<br />{a.line1}, {a.city}, {a.state} {a.pincode}
                    </p>
                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                      {!a.isDefault && (
                        <button className="btn btn-ghost btn-sm" onClick={async () => {
                          const res = await api.updateAddress(a.id, { isDefault: true });
                          if (res.ok) { setAddresses((await api.addresses()) ?? []); S.toast("Default address updated"); }
                          else S.toast(res.message!, true);
                        }}>Make default</button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={async () => {
                        const res = await api.removeAddress(a.id);
                        if (res.ok) { setAddresses((await api.addresses()) ?? []); S.toast("Address removed"); }
                        else S.toast(res.message!, true);
                      }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => S.go("checkout")}>
                Add a new address
              </button>
            </>
          )}

          {tab === "Reward points" && (
            <>
              <h2 style={{ marginBottom: 18 }}>Reward points</h2>
              <div className="kpi" style={{ marginBottom: 22 }}>
                <span className="pc-cat">Available balance</span>
                <b>{points?.balance ?? S.user.points ?? 0} pts</b>
                <span className="muted" style={{ fontSize: ".82rem" }}>
                  Redeemable 1:1 against any order above ₹2,000. No expiry.
                </span>
              </div>
              {points?.entries?.length ? (
                <table className="tbl">
                  <thead><tr><th>Activity</th><th>Date</th><th>Points</th></tr></thead>
                  <tbody>
                    {points.entries.map((e: any) => (
                      <tr key={e.id}>
                        <td>{e.reason}</td>
                        <td>{new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td style={{ color: e.delta > 0 ? "#2E7D4F" : "#C0392B" }}>{e.delta > 0 ? "+" : ""}{e.delta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="muted">Points appear here once your first order ships.</p>}
            </>
          )}

          {tab === "Refer & earn" && (
            <>
              <h2 style={{ marginBottom: 8 }}>Refer & earn</h2>
              <p className="muted" style={{ marginBottom: 22 }}>
                They get ₹500 off their first order. You get 500 points once it ships.
              </p>
              <div style={{ display: "flex", gap: 10, maxWidth: 460 }}>
                <input className="inp" readOnly value={referrals?.link ?? `divyaloka.com/r/${S.user.referralCode ?? ""}`} />
                <button className="btn btn-primary" onClick={() => {
                  navigator.clipboard?.writeText(referrals?.link ?? `https://divyaloka.com/r/${S.user.referralCode}`);
                  S.toast("Referral link copied");
                }}>Copy</button>
              </div>
              <div className="grid g3" style={{ marginTop: 26 }}>
                {[["Signed up", referrals?.signedUp ?? 0], ["Placed an order", referrals?.converted ?? 0], ["Points earned", referrals?.pointsEarned ?? 0]].map(([t, v]) => (
                  <div key={t as string} className="kpi"><span className="pc-cat">{t}</span><b>{v}</b></div>
                ))}
              </div>
            </>
          )}

          {tab === "Support" && (
            <>
              <h2 style={{ marginBottom: 18 }}>Support tickets</h2>
              <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: 22, marginBottom: 22 }}>
                <label className="field"><span>What do you need help with?</span>
                  <select className="inp" value={ticket.category} onChange={(e) => setTicket({ ...ticket, category: e.target.value })}>
                    {["Order issue", "Return or refund", "Puja booking", "Product authenticity", "Something else"].map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
                <label className="field"><span>Subject</span>
                  <input className="inp" value={ticket.subject} onChange={(e) => setTicket({ ...ticket, subject: e.target.value })} placeholder="One line" />
                </label>
                <label className="field"><span>Describe the issue</span>
                  <textarea className="inp" value={ticket.body} onChange={(e) => setTicket({ ...ticket, body: e.target.value })}
                    placeholder="Include your order number if relevant" />
                </label>
                <button className="btn btn-primary" disabled={busy || !ticket.subject || !ticket.body}
                  onClick={async () => {
                    setBusy(true);
                    const res = await api.createTicket(ticket);
                    setBusy(false);
                    if (!res.ok) { S.toast(res.message!, true); return; }
                    setTickets((await api.tickets()) ?? []);
                    setTicket({ category: "Order issue", subject: "", body: "" });
                    S.toast(`Ticket ${res.data.number} raised. First reply within 4 hours.`);
                  }}>
                  {busy ? "Sending…" : "Raise ticket"}
                </button>
              </div>

              {tickets.length > 0 && (
                <table className="tbl">
                  <thead><tr><th>Ticket</th><th>Subject</th><th>Updated</th><th>Status</th></tr></thead>
                  <tbody>
                    {tickets.map((t: any) => (
                      <tr key={t.id}>
                        <td>{t.number}</td>
                        <td>{t.subject}</td>
                        <td>{new Date(t.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td><span className={`pill ${t.status === "RESOLVED" ? "ok" : "warn"}`}>{t.status.toLowerCase()}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/* ============================ CONTENT PAGES ============================ */

function Blog({ posts: initial }: { posts?: any[] } = {}) {
  const S = useShop();
  // Rendered server-side from the prop so the articles are in the initial HTML;
  // the client fetch only has to cover the case where the page was not prefilled.
  const [posts, setPosts] = useState<any[]>(initial ?? []);

  useEffect(() => {
    if (initial?.length) return;
    api.posts(24).then((rows) => {
      setPosts((rows ?? []).map(normPost));
    });
  }, [initial]);

  return (
    <main className="wrap" style={{ padding: "40px 24px 80px" }}>
      <span className="eyebrow">Journal</span>
      <h1 style={{ margin: "12px 0 10px" }}>Notes on beads, ritual and practice</h1>
      <p className="muted" style={{ maxWidth: "60ch", marginBottom: 36 }}>Written by our sourcing team in Varanasi and two senior pandits. No affiliate links, no sponsored posts.</p>
      <div className="grid g3">
        {posts.map((b: any, i: number) => (
          <Reveal key={b.slug ?? i} delay={(i % 3) * 60} className="card" style={{ cursor: "pointer" }}>
            <div className="pc-media" style={{ aspectRatio: "3/2" }}>
              <div style={{ position: "absolute", inset: "14%" }}><Art kind={["bead", "book", "yantra", "mala"][i % 4]} tone={i % 2 ? "gold" : "rudraksha"} mukhi={(i % 5) + 1} id={`bl${i}`} /></div>
            </div>
            <div className="pc-body">
              <span className="pc-cat">{b.category} · {b.readMinutes} min read{b.author ? ` · ${b.author}` : ""}</span>
              <h3 className="pc-name">{b.title}</h3>
              <p className="muted" style={{ fontSize: ".85rem" }}>{b.excerpt}</p>
              <button className="link-more" style={{ marginTop: 14, display: "inline-block" }} onClick={() => S.toast("Opening article")}>Read</button>
            </div>
          </Reveal>
        ))}
      </div>
    </main>
  );
}

function About() {
  return (
    <main>
      <section className="wrap" style={{ padding: "60px 24px 30px", maxWidth: 860 }}>
        <span className="eyebrow">Our story</span>
        <h1 style={{ margin: "14px 0 20px" }}>Three generations, one rule: never sell what you cannot prove.</h1>
        <p style={{ fontSize: "1.06rem", color: "var(--ink-2)" }}>
          Divyaloka began in 1974 as a single counter near Dashashwamedh Ghat. My grandfather sold rudraksha to pilgrims and refused any bead he had not seen split open in the harvest season. That refusal is still the business.
        </p>
        <p style={{ marginTop: 16, color: "var(--ink-2)" }}>
          Today we buy directly from six farms across the Nepal–India Himalayan belt, X-ray every bead above ₹2,000, and publish the report with the order. Our 340 pandits are met in person before they take a booking. Nothing is described as energised unless we can tell you the temple, the date and the priest.
        </p>
      </section>
      <section className="wrap sec">
        <div className="grid g3">
          {[["Sourcing", "Six farms, fixed annual contracts, harvest audited by our own team every October."],
          ["Verification", "IGI lab partnership in Varanasi. X-ray, mukhi count, weight and density on record."],
          ["Fair pricing", "Pandit dakshina goes to the pandit in full. We earn on the vidhi fee, disclosed on every booking."]].map(([t, d]) => (
            <Reveal key={t} style={{ border: "1px solid var(--line)", borderRadius: 16, padding: 26, background: "var(--surface)" }}>
              <h3 style={{ marginBottom: 10 }}>{t}</h3><p className="muted">{d}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </main>
  );
}

function Contact() {
  const S = useShop();
  return (
    <main className="wrap" style={{ padding: "50px 24px 80px" }}>
      <div className="grid g2" style={{ gap: 44 }}>
        <div>
          <span className="eyebrow">Contact</span>
          <h1 style={{ margin: "12px 0 16px" }}>Talk to a human</h1>
          <p className="muted" style={{ marginBottom: 26 }}>Our advisors answer in Hindi, English, Tamil and Marathi, 9am–9pm IST.</p>
          <dl className="spec">
            <dt>Store</dt><dd>D 14/9 Dashashwamedh Road, Varanasi 221001</dd>
            <dt>Phone</dt><dd>+91 98765 43210</dd>
            <dt>WhatsApp</dt><dd>+91 98765 43210</dd>
            <dt>Email</dt><dd>care@divyaloka.com</dd>
            <dt>Puja desk</dt><dd>puja@divyaloka.com · 7am–10pm IST</dd>
          </dl>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 18, padding: 28 }}>
          <label className="field"><span>Name</span><input className="inp" /></label>
          <label className="field"><span>Email or phone</span><input className="inp" /></label>
          <label className="field"><span>Message</span><textarea className="inp" /></label>
          <button className="btn btn-primary btn-block" onClick={() => S.toast("Message sent. We reply within 4 hours.")}>Send message</button>
        </div>
      </div>
    </main>
  );
}

/* ============================ PANDIT PANEL ============================ */

const iso = (d: Date) => d.toISOString().slice(0, 10);

function PanditPanel() {
  const S = useShop();
  const [tab, setTab] = useState("Schedule");
  const [profile, setProfile] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [income, setIncome] = useState<any>(null);
  const [pujas, setPujas] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = iso(new Date());
  const to = iso(new Date(Date.now() + 21 * 86400000));

  const load = useCallback(async () => {
    const p = await api.panditProfile();
    if (!p) { setError("This console is for approved pandits. Sign in with a pandit account."); return; }
    setProfile(p);
    setForm({
      displayName: p.displayName, city: p.city, veda: p.veda,
      languages: (p.languages ?? []).join(", "), dakshina: Math.round((p.dakshina ?? 0) / 100), bio: p.bio ?? "",
    });
    const [sc, rq, av, inc, pj] = await Promise.all([
      api.panditSchedule(from, to), api.panditRequests(), api.panditAvailability(from, to),
      api.panditIncome(), api.pujas(),
    ]);
    setSchedule(sc ?? []); setRequests(rq ?? []); setSlots(av ?? []);
    setIncome(inc); setPujas((pj ?? []).map(normPuja));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  if (error) return (
    <main className="wrap" style={{ padding: "80px 24px", textAlign: "center", maxWidth: 520 }}>
      <h2>Pandit console</h2>
      <p className="muted" style={{ margin: "12px 0 24px" }}>{error}</p>
      <button className="btn btn-primary" onClick={() => S.go("login")}>Sign in</button>
      <button className="btn btn-ghost" style={{ marginLeft: 12 }} onClick={() => S.go("home")}>Back to store</button>
    </main>
  );

  const today = schedule.filter((b: any) => new Date(b.scheduledAt).toDateString() === new Date().toDateString());
  const week = schedule.filter((b: any) => new Date(b.scheduledAt) < new Date(Date.now() + 7 * 86400000));
  const SLOT_TIMES = ["06:30", "08:00", "11:00", "14:00", "18:00", "21:00"];

  const toggleSlot = async (date: string, slot: string, open: boolean) => {
    setBusy(true);
    const res = await api.setPanditAvailability([{ date, slots: [slot], open }]);
    setBusy(false);
    if (!res.ok) { S.toast(res.message!, true); return; }
    setSlots((await api.panditAvailability(from, to)) ?? []);
    S.toast(open ? `${slot} opened for bookings` : `${slot} blocked`);
  };

  return (
    <div className="admin">
      <aside className="aside">
        <div style={{ padding: "0 24px 22px", display: "flex", gap: 10, alignItems: "center" }}>
          <LotusMark size={30} /><span style={{ fontFamily: "var(--display)", color: "#fff" }}>Pandit</span>
        </div>
        {["Schedule", "Requests", "Availability", "Services", "Profile", "Income"].map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t}{t === "Requests" && requests.length > 0 ? ` (${requests.length})` : ""}
          </button>
        ))}
        <button onClick={() => S.go("home")}>← Back to store</button>
      </aside>

      <div style={{ padding: 32, background: "var(--bg)" }}>
        <h1 style={{ fontSize: "1.8rem", marginBottom: 6 }}>Namaste, {profile?.displayName ?? "…"}</h1>
        <p className="muted" style={{ marginBottom: 28 }}>
          {profile ? `${profile.city} · ${profile.experienceYrs} years · ${Number(profile.ratingAvg).toFixed(1)} from ${profile.ratingCount} reviews` : "Loading…"}
        </p>

        {tab === "Schedule" && (
          <>
            <div className="grid g4" style={{ marginBottom: 28 }}>
              {[["Today", `${today.length} pujas`], ["Next 7 days", `${week.length} pujas`],
              ["Open slots", `${slots.filter((s: any) => s.status === "OPEN").length}`],
              ["Pending requests", `${requests.length}`]].map(([t, v]) => (
                <div key={t as string} className="kpi"><span className="pc-cat">{t}</span><b style={{ fontSize: "1.3rem" }}>{v}</b></div>
              ))}
            </div>

            <h3 style={{ marginBottom: 14 }}>Upcoming</h3>
            {schedule.length === 0 ? <p className="muted">Nothing booked in the next three weeks.</p> : (
              <table className="tbl">
                <thead><tr><th>When</th><th>Puja</th><th>Client</th><th>Mode</th><th>Where</th></tr></thead>
                <tbody>
                  {schedule.map((b: any) => (
                    <tr key={b.id}>
                      <td>{new Date(b.scheduledAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td>{b.puja?.name}</td>
                      <td>{b.user?.name}<br /><span className="muted" style={{ fontSize: ".74rem" }}>{b.user?.phone}</span></td>
                      <td>{String(b.mode).toLowerCase()}</td>
                      <td>{b.address ? `${b.address.line1}, ${b.address.city}` : b.meetingUrl ? "Video" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {tab === "Requests" && (
          <>
            <h3 style={{ marginBottom: 14 }}>Booking requests</h3>
            {requests.length === 0 ? (
              <p className="muted">No pending requests. New ones appear here with a two-hour response window.</p>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {requests.map((r: any) => (
                  <div key={r.id} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 20, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <span className="pc-cat">{r.reference}</span>
                      <b style={{ display: "block", fontFamily: "var(--display)", fontWeight: 500, margin: "4px 0" }}>{r.puja?.name}</b>
                      <span className="muted" style={{ fontSize: ".84rem" }}>
                        {new Date(r.scheduledAt).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {" · "}{String(r.mode).toLowerCase()}
                        {r.address ? ` · ${r.address.city}` : ""}
                      </span>
                    </div>
                    <b>{money(Math.round((r.dakshina ?? 0) / 100))}</b>
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={async () => {
                      setBusy(true);
                      const res = await api.acceptRequest(r.id);
                      setBusy(false);
                      S.toast(res.ok ? "Accepted — the client has been notified" : res.message!, !res.ok);
                      if (res.ok) load();
                    }}>Accept</button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => {
                      setBusy(true);
                      const res = await api.declineRequest(r.id, "Not available");
                      setBusy(false);
                      S.toast(res.ok ? "Declined — reassigning to another pandit" : res.message!, !res.ok);
                      if (res.ok) load();
                    }}>Decline</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "Availability" && (
          <>
            <h3 style={{ marginBottom: 6 }}>Availability</h3>
            <p className="muted" style={{ marginBottom: 20 }}>
              Tap a slot to open or block it. Slots with a paid booking cannot be blocked.
            </p>
            <div style={{ display: "grid", gap: 14, maxWidth: 720 }}>
              {Array.from({ length: 14 }).map((_, d) => {
                const date = new Date(Date.now() + d * 86400000);
                const key = iso(date);
                return (
                  <div key={key} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ width: 110, fontSize: ".84rem" }}>
                      {date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                    <div className="chips">
                      {SLOT_TIMES.map((s) => {
                        const row = slots.find((x: any) => x.date?.slice(0, 10) === key && x.slot === s);
                        const status = row?.status ?? "BLOCKED";
                        const booked = status === "BOOKED";
                        return (
                          <button key={s} className={`chip ${status === "OPEN" ? "on" : ""}`} disabled={booked || busy}
                            title={booked ? "Booked" : status === "OPEN" ? "Open — tap to block" : "Blocked — tap to open"}
                            style={booked ? { background: "var(--gold)", color: "#3A2A0C", borderColor: "var(--gold)" } : undefined}
                            onClick={() => toggleSlot(key, s, status !== "OPEN")}>
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "Services" && (
          <>
            <h3 style={{ marginBottom: 6 }}>Services you offer</h3>
            <p className="muted" style={{ marginBottom: 18 }}>Only these pujas will route bookings to you.</p>
            <div className="chips">
              {pujas.map((p: any) => {
                const on = (profile?.services ?? []).some((s: any) => s.pujaId === p.id);
                return (
                  <button key={p.id} className={`chip ${on ? "on" : ""}`} disabled={busy} onClick={async () => {
                    const current = (profile?.services ?? []).map((s: any) => s.pujaId);
                    const next = on ? current.filter((x: string) => x !== p.id) : [...current, p.id];
                    setBusy(true);
                    const res = await api.panditServices(next);
                    setBusy(false);
                    if (!res.ok) { S.toast(res.message!, true); return; }
                    setProfile(res.data);
                    S.toast("Service list updated");
                  }}>{p.name}</button>
                );
              })}
            </div>
          </>
        )}

        {tab === "Profile" && form && (
          <div style={{ maxWidth: 620 }}>
            <div className="grid g2" style={{ gap: 0, columnGap: 18 }}>
              <label className="field"><span>Display name</span>
                <input className="inp" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
              <label className="field"><span>Dakshina per puja (₹)</span>
                <input className="inp" type="number" value={form.dakshina} onChange={(e) => setForm({ ...form, dakshina: +e.target.value })} /></label>
            </div>
            <label className="field"><span>City</span>
              <input className="inp" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
            <label className="field"><span>Veda / lineage</span>
              <input className="inp" value={form.veda} onChange={(e) => setForm({ ...form, veda: e.target.value })} /></label>
            <label className="field"><span>Languages (comma separated)</span>
              <input className="inp" value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} /></label>
            <label className="field"><span>About you</span>
              <textarea className="inp" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></label>

            <label className="field"><span>Certificates</span>
              <div style={{ border: "1px dashed var(--line)", borderRadius: 12, padding: 18, fontSize: ".86rem" }}>
                {(profile?.certificates ?? []).length === 0 ? "None on file yet." : (profile.certificates.map((c: any) => (
                  <div key={c.id}>
                    {c.title} ({c.issuer}) ·{" "}
                    {c.verifiedAt ? `verified ${new Date(c.verifiedAt).toLocaleDateString("en-IN")}` : "awaiting verification"}
                  </div>
                )))}
              </div>
            </label>

            <button className="btn btn-primary" disabled={busy} onClick={async () => {
              setBusy(true);
              const res = await api.updatePanditProfile({
                displayName: form.displayName, city: form.city, veda: form.veda, bio: form.bio,
                languages: form.languages.split(",").map((s: string) => s.trim()).filter(Boolean),
                dakshina: Math.round(form.dakshina * 100),
              });
              setBusy(false);
              S.toast(res.ok ? "Profile saved" : res.message!, !res.ok);
              if (res.ok) load();
            }}>{busy ? "Saving…" : "Save profile"}</button>
          </div>
        )}

        {tab === "Income" && (
          <>
            <div className="grid g4" style={{ marginBottom: 28 }}>
              {[["This month", income?.thisMonth], ["Pending payout", income?.pendingPayout],
              ["Lifetime", income?.lifetime], ["Avg per puja", income?.averagePerPuja]].map(([t, v]) => (
                <div key={t as string} className="kpi">
                  <span className="pc-cat">{t}</span>
                  <b style={{ fontSize: "1.4rem" }}>{money(Math.round((Number(v) || 0) / 100))}</b>
                </div>
              ))}
            </div>
            <p className="muted" style={{ marginBottom: 20, fontSize: ".85rem" }}>
              Figures are net of the {income?.commissionPct ?? 12}% platform commission, across {income?.completedCount ?? 0} completed pujas.
            </p>

            <h3 style={{ marginBottom: 14 }}>Withdrawals</h3>
            {(income?.payouts ?? []).length === 0 ? <p className="muted">No withdrawals yet.</p> : (
              <table className="tbl">
                <thead><tr><th>Requested</th><th>Amount</th><th>Period</th><th>Status</th></tr></thead>
                <tbody>
                  {income.payouts.map((p: any) => (
                    <tr key={p.id}>
                      <td>{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td>{money(Math.round(p.amount / 100))}</td>
                      <td>{new Date(p.periodStart).toLocaleDateString("en-IN", { month: "short" })} – {new Date(p.periodEnd).toLocaleDateString("en-IN", { month: "short" })}</td>
                      <td><span className={`pill ${p.status === "PAID" ? "ok" : "warn"}`}>{p.status.toLowerCase()}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await api.requestPayout();
                setBusy(false);
                S.toast(res.ok ? "Withdrawal requested — settles in 2 working days" : res.message!, !res.ok);
                if (res.ok) load();
              }}>Request withdrawal</button>
          </>
        )}
      </div>
    </div>
  );
}

export { BookPuja, Checkout, Login, Account, Blog, About, Contact, PanditPanel, DAYS, MUHURAT };
