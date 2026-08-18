"use client";
import React from "react";


/* ============================================================
   DIVYALOKA — Luxury Spiritual Commerce
   Single-file reference implementation of the storefront,
   Book Puja module, customer account, pandit view and admin.
   ============================================================ */


/* ============================ ART SYSTEM ============================
   Product imagery is drawn as SVG so every card is crisp, themable and
   dark-mode aware — no image requests, no layout shift. */

const TONES = {
  rudraksha: ["#7A4A21", "#4A2A11", "#2A1608"],
  tulsi: ["#8E6B3C", "#5C4222", "#33240F"],
  sphatik: ["#F2F5FA", "#C9D6E6", "#8FA3BC"],
  ruby: ["#C86A6A", "#8E2F35", "#511418"],
  emerald: ["#7FB08D", "#2F7A54", "#124228"],
  amethyst: ["#B199D6", "#6C4E9E", "#33214F"],
  gold: ["#F0DCA4", "#C9A94E", "#8A6D1E"],
  saffronCloth: ["#F5B75B", "#E0801B", "#A9530D"],
  cream: ["#FBF3E4", "#E7D8BC", "#BCA987"],
};

/* Math.cos/Math.sin are not required to be correctly rounded, and Node's V8 and the
   browser's disagree in the last bit — the server renders a bead at 53.92502082040156
   and the client computes ...57, which React reports as a hydration mismatch. Quantising
   to 3 decimals of a 200-unit viewBox is well under a pixel and makes both sides emit the
   same string. Everything downstream derives from these two values, so rounding here is
   enough; plain arithmetic is already deterministic. */
const q = (n) => Math.round(n * 1000) / 1000;

function Bead({ cx, cy, r, tone, id, lines = 5 }) {
  const [l, m, d] = TONES[tone] || TONES.rudraksha;
  const g = `bd-${id}`;
  return (
    <g>
      <defs>
        <radialGradient id={g} cx="34%" cy="30%" r="76%">
          <stop offset="0%" stopColor={l} />
          <stop offset="52%" stopColor={m} />
          <stop offset="100%" stopColor={d} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${g})`} />
      {Array.from({ length: lines }).map((_, i) => {
        const off = -r + (2 * r * (i + 0.5)) / lines;
        return (
          <path key={i} d={`M ${cx + off} ${cy - r * 0.93} Q ${cx + off * 1.5} ${cy} ${cx + off} ${cy + r * 0.93}`}
            fill="none" stroke={d} strokeOpacity=".65" strokeWidth={Math.max(0.6, r * 0.055)} />
        );
      })}
      <ellipse cx={cx - r * 0.3} cy={cy - r * 0.36} rx={r * 0.3} ry={r * 0.2}
        fill="#fff" opacity=".22" transform={`rotate(-28 ${cx - r * 0.3} ${cy - r * 0.36})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={d} strokeOpacity=".45" strokeWidth=".8" />
    </g>
  );
}

function Art({ kind = "bead", tone = "rudraksha", mukhi = 5, id = "x", className = "" }) {
  const [, , dark] = TONES[tone] || TONES.rudraksha;
  const V = { width: "100%", height: "100%", display: "block" };
  const halo = (
    <>
      <circle cx="100" cy="100" r="74" fill="none" stroke="var(--gold-line)" strokeOpacity=".5" strokeDasharray="1 7" strokeLinecap="round" />
      <circle cx="100" cy="100" r="86" fill="none" stroke="var(--gold-line)" strokeOpacity=".28" />
    </>
  );
  if (kind === "mala") {
    const n = 30, R = 62;
    return (
      <svg viewBox="0 0 200 200" style={V} className={className} role="img" aria-label="Mala">
        {halo}
        {Array.from({ length: n }).map((_, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          return <Bead key={i} id={`${id}-${i}`} cx={q(100 + R * Math.cos(a))} cy={q(100 + R * Math.sin(a))} r={8.2} tone={tone} lines={Math.min(mukhi, 6)} />;
        })}
        <Bead id={`${id}-guru`} cx={100} cy={172} r={13} tone={tone} lines={Math.min(mukhi, 6)} />
        <path d="M100 184 L96 199 M100 184 L100 200 M100 184 L104 199" stroke={dark} strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "bracelet") {
    const n = 16, R = 52;
    return (
      <svg viewBox="0 0 200 200" style={V} className={className} role="img" aria-label="Bracelet">
        {halo}
        <ellipse cx="100" cy="104" rx={R} ry={R * 0.72} fill="none" stroke="var(--gold-line)" strokeOpacity=".4" />
        {Array.from({ length: n }).map((_, i) => {
          const a = (i / n) * Math.PI * 2;
          return <Bead key={i} id={`${id}-${i}`} cx={q(100 + R * Math.cos(a))} cy={q(104 + R * 0.72 * Math.sin(a))} r={12} tone={tone} lines={Math.min(mukhi, 6)} />;
        })}
      </svg>
    );
  }
  if (kind === "pendant") {
    return (
      <svg viewBox="0 0 200 200" style={V} className={className} role="img" aria-label="Pendant">
        {halo}
        <path d="M62 34 Q100 8 138 34" fill="none" stroke="#C9A94E" strokeWidth="3" strokeLinecap="round" />
        <path d="M100 34 L100 74" stroke="#C9A94E" strokeWidth="2.6" />
        <path d="M84 74 Q100 62 116 74 L112 88 L88 88 Z" fill="#C9A94E" opacity=".9" />
        <Bead id={`${id}-p`} cx={100} cy={126} r={38} tone={tone} lines={mukhi} />
      </svg>
    );
  }
  if (kind === "cloth") {
    const [l, m, d] = TONES[tone] || TONES.saffronCloth;
    return (
      <svg viewBox="0 0 200 200" style={V} className={className} role="img" aria-label="Garment">
        {halo}
        <path d="M64 44 L100 58 L136 44 L156 66 L140 82 L140 168 Q100 176 60 168 L60 82 L44 66 Z" fill={m} />
        <path d="M64 44 L100 58 L136 44 L128 44 Q100 74 72 44 Z" fill={d} opacity=".7" />
        <path d="M60 152 Q100 160 140 152 L140 168 Q100 176 60 168 Z" fill={d} opacity=".55" />
        <path d="M100 60 L100 168" stroke={l} strokeWidth="1.4" opacity=".55" strokeDasharray="4 5" />
        {[74, 92, 110].map((y) => <circle key={y} cx="100" cy={y} r="2.6" fill="#C9A94E" />)}
        <path d="M60 84 L140 84" stroke="#C9A94E" strokeWidth="1.2" opacity=".6" />
      </svg>
    );
  }
  if (kind === "yantra") {
    return (
      <svg viewBox="0 0 200 200" style={V} className={className} role="img" aria-label="Yantra">
        {halo}
        <rect x="34" y="34" width="132" height="132" fill="none" stroke="#C9A94E" strokeWidth="2.4" />
        <rect x="42" y="42" width="116" height="116" fill="none" stroke="#C9A94E" strokeOpacity=".55" />
        <circle cx="100" cy="100" r="52" fill="none" stroke="#C9A94E" strokeWidth="1.6" />
        {[0, 1, 2].map((i) => (
          <polygon key={i} points="100,58 142,128 58,128" fill="none" stroke="#B85C10"
            strokeWidth="1.5" transform={`rotate(${i * 60} 100 100) scale(${1 - i * 0.14}) translate(${i * 14} ${i * 14})`} />
        ))}
        {[0, 1, 2].map((i) => (
          <polygon key={i} points="100,142 58,72 142,72" fill="none" stroke="#8A6D1E"
            strokeWidth="1.5" transform={`rotate(${i * 60} 100 100) scale(${1 - i * 0.16}) translate(${i * 16} ${i * 16})`} />
        ))}
        <circle cx="100" cy="100" r="5" fill="#B85C10" />
      </svg>
    );
  }
  if (kind === "incense") {
    return (
      <svg viewBox="0 0 200 200" style={V} className={className} role="img" aria-label="Incense">
        {halo}
        {[-26, 0, 26].map((dx, i) => (
          <g key={i}>
            <path d={`M${100 + dx} 168 L${100 + dx} 76`} stroke="#5A4230" strokeWidth="3" strokeLinecap="round" />
            <circle cx={100 + dx} cy="74" r="3.4" fill="#E0801B" />
            <path d={`M${100 + dx} 68 C${112 + dx} 54 ${88 + dx} 44 ${100 + dx} 26`} fill="none"
              stroke="var(--ink-3)" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
          </g>
        ))}
        <path d="M62 168 Q100 156 138 168 L138 180 Q100 188 62 180 Z" fill="#8A6D1E" />
      </svg>
    );
  }
  if (kind === "idol") {
    return (
      <svg viewBox="0 0 200 200" style={V} className={className} role="img" aria-label="Idol">
        {halo}
        <path d="M56 176 Q100 186 144 176 L138 158 L62 158 Z" fill="#8A6D1E" />
        <path d="M70 158 Q70 96 100 84 Q130 96 130 158 Z" fill="#C9A94E" />
        <circle cx="100" cy="72" r="24" fill="#E0C77E" />
        <path d="M100 48 Q88 30 100 18 Q112 30 100 48" fill="#B85C10" />
        <path d="M88 70 q12 -8 24 0" stroke="#8A6D1E" strokeWidth="2" fill="none" />
        <path d="M100 96 v34 M84 112 h32" stroke="#8A6D1E" strokeWidth="2" opacity=".7" />
      </svg>
    );
  }
  if (kind === "samagri") {
    return (
      <svg viewBox="0 0 200 200" style={V} className={className} role="img" aria-label="Puja samagri">
        {halo}
        <path d="M66 108 Q66 156 100 168 Q134 156 134 108 Z" fill="#C9A94E" />
        <ellipse cx="100" cy="106" rx="34" ry="10" fill="#E0C77E" />
        <path d="M86 96 q14 -14 28 0" stroke="#8A6D1E" strokeWidth="2" fill="none" />
        <circle cx="100" cy="84" r="12" fill="#E0801B" />
        <path d="M100 72 q8 -14 0 -24 q-8 10 0 24" fill="#F5B75B" />
        <path d="M52 176 h96" stroke="#8A6D1E" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "book") {
    return (
      <svg viewBox="0 0 200 200" style={V} className={className} role="img" aria-label="Book">
        {halo}
        <rect x="52" y="44" width="96" height="120" rx="6" fill="#8A4A18" />
        <rect x="58" y="50" width="84" height="108" rx="4" fill="#E7D8BC" />
        <path d="M100 50 v108" stroke="#BCA987" strokeWidth="1.4" />
        <circle cx="100" cy="104" r="20" fill="none" stroke="#B85C10" strokeWidth="1.6" />
        <path d="M92 96 q10 -10 18 2 q-10 12 -18 -2" fill="#B85C10" opacity=".8" />
        <path d="M74 74 h20 M106 74 h20 M74 136 h20 M106 136 h20" stroke="#BCA987" strokeWidth="1.6" />
      </svg>
    );
  }
  if (kind === "gift") {
    return (
      <svg viewBox="0 0 200 200" style={V} className={className} role="img" aria-label="Gift box">
        {halo}
        <rect x="50" y="86" width="100" height="82" rx="6" fill="#E7D8BC" />
        <rect x="44" y="68" width="112" height="26" rx="6" fill="#C9A94E" />
        <rect x="92" y="68" width="16" height="100" fill="#B85C10" opacity=".85" />
        <path d="M100 68 q-26 -26 -8 -34 q14 -6 8 34" fill="#E0801B" />
        <path d="M100 68 q26 -26 8 -34 q-14 -6 -8 34" fill="#F5B75B" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 200" style={V} className={className} role="img" aria-label="Rudraksha bead">
      {halo}
      <Bead id={`${id}-solo`} cx={100} cy={100} r={54} tone={tone} lines={mukhi} />
    </svg>
  );
}

/* ---------- icons ---------- */
const I = {
  search: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" strokeLinecap="round" /></svg>,
  heart: (f) => <svg width="19" height="19" viewBox="0 0 24 24" fill={f ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6"><path d="M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.4 12 20 12 20z" /></svg>,
  bag: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 8h12l1 12H5L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>,
  user: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.6 4-5.2 7-5.2s5.8 1.6 7 5.2" strokeLinecap="round" /></svg>,
  moon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>,
  sun: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" strokeLinecap="round" /></svg>,
  x: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  chev: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>,
  menu: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  check: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>,
  shield: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3l7 3v6c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" strokeLinecap="round" /></svg>,
  truck: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" /></svg>,
  leaf: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 4C10 4 4 9 4 16v4" strokeLinecap="round" /><path d="M20 4c0 9-5 13-11 13" /></svg>,
  star: (f) => <svg width="13" height="13" viewBox="0 0 24 24" fill={f ? "#C9A94E" : "none"} stroke="#C9A94E" strokeWidth="1.4"><path d="M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.9l6-.8L12 3.5z" /></svg>,
  play: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z" /></svg>,
  cube: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></svg>,
  zoom: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><path d="M11 8v6M8 11h6M20 20l-3.5-3.5" strokeLinecap="round" /></svg>,
  cal: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" /></svg>,
  pin: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></svg>,
  chat: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20 12a8 8 0 1 1-3.4-6.5" strokeLinecap="round" /><path d="M4.5 19.5L6 15" strokeLinecap="round" /></svg>,
  mic: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 12a6.5 6.5 0 0 0 13 0M12 18.5V21" strokeLinecap="round" /></svg>,
};

const LotusMark = ({ size = 38 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="22.4" fill="none" stroke="var(--gold-line)" strokeWidth="1" />
    <circle cx="24" cy="24" r="18" fill="none" stroke="var(--gold-line)" strokeOpacity=".55" strokeDasharray="1 5" />
    {[-52, -26, 0, 26, 52].map((a, i) => (
      <path key={i} d="M24 34 C16 27 18 15 24 10 C30 15 32 27 24 34Z"
        fill={i === 2 ? "var(--saffron)" : "var(--saffron-soft)"} opacity={i === 2 ? 1 : 0.55}
        transform={`rotate(${a} 24 30)`} />
    ))}
    <circle cx="24" cy="12.5" r="2.6" fill="var(--gold)" />
  </svg>
);


export { Bead, Art, I, LotusMark, TONES };
