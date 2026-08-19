/**
 * The API stores money as integer paise; the UI was written in rupees.
 * Everything crossing that boundary goes through here exactly once, so a live
 * catalogue never renders at 100× the real price.
 */

const toRupees = (paise?: number | null) => (paise == null ? 0 : Math.round(paise) / 100);

export function normProduct(p: any) {
  if (!p) return null;
  if (p.__norm) return p;

  return {
    __norm: true,
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    category: p.category ?? p.categoryName ?? "",
    categorySlug: p.categorySlug,
    price: toRupees(p.price),
    mrp: toRupees(p.mrp),
    kind: p.artKind ?? p.kind ?? "bead",
    tone: p.artTone ?? p.tone ?? "rudraksha",
    mukhi: p.mukhi ?? 5,
    badge: p.badge,
    featured: p.featured,
    rating: Number(p.rating ?? p.ratingAvg ?? 0),
    reviews: p.reviewCount ?? p.ratingCount ?? p.reviews ?? 0,
    stock: p.stock ?? 0,
    desc: p.description ?? p.desc ?? "",
    benefits: Array.isArray(p.benefits) ? p.benefits : [],
    wear: p.howToWear ?? p.wear ?? "",
    care: p.careNotes ?? p.care ?? "",
    material: p.material ?? "—",
    origin: p.origin ?? "—",
    weight: p.weightGrams ? `${p.weightGrams} g` : p.weight ?? "—",
    size: p.dimensions ?? p.size ?? "—",
    gstRate: p.gstRate,
    variants: p.variants,
    certificates: p.certificates,
    media: p.media,
    seo: p.seo,
    serverReviews: p.reviews && Array.isArray(p.reviews) ? p.reviews : [],
    related: (p.related ?? []).map(normProduct),
  };
}

export const normProducts = (rows?: any[] | null) => (rows ?? []).map(normProduct).filter(Boolean);

export function normPuja(p: any) {
  if (!p) return null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    dur: p.durationMin ? `${Math.round((p.durationMin / 60) * 10) / 10} hrs` : p.dur ?? "—",
    durationMin: p.durationMin,
    price: p.baseFee != null ? toRupees(p.baseFee) : p.price ?? 0,
    samagri: p.samagriFee != null ? toRupees(p.samagriFee) : 0,
    note: p.description ?? p.note ?? "",
    pandits: p.panditCount ?? p.pandits ?? 1,
  };
}

export function normPandit(p: any) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name ?? p.displayName,
    city: p.city,
    exp: p.experienceYrs ?? p.exp ?? 0,
    veda: p.veda,
    langs: p.languages ?? p.langs ?? [],
    fee: p.dakshina != null ? toRupees(p.dakshina) : p.fee ?? 0,
    rating: Number(p.rating ?? p.ratingAvg ?? 0),
    reviews: p.reviewCount ?? p.reviews ?? 0,
    slots: p.slots ?? [],
    bio: p.bio,
  };
}

/**
 * Testimonials come from approved reviews. The bundled fallback uses the older
 * short keys (n/c/t/p), so accept both shapes rather than branching at the call site.
 */
/**
 * Nav category tree. The API returns items as objects; the bundled CATEGORY_TREE
 * uses bare strings. Both collapse to { group, items: [{ name, slug }] } here so
 * the menus never have to know which one they got.
 */
export function normCategories(groups?: any[] | null) {
  return (groups ?? []).map((g: any) => ({
    group: g.group ?? g.groupName ?? "",
    items: (g.items ?? []).map((c: any) =>
      typeof c === "string"
        ? { name: c, slug: c.toLowerCase().replace(/[^a-z0-9]+/g, "-"), productCount: null }
        : { name: c.name, slug: c.slug, id: c.id, productCount: c.productCount ?? null },
    ),
  }));
}

export function normTestimonial(t: any) {
  if (!t) return null;
  return {
    id: t.id ?? t.n ?? t.name,
    name: t.name ?? t.n ?? "Verified buyer",
    city: t.city ?? t.c ?? "",
    text: t.text ?? t.t ?? "",
    rating: Number(t.rating ?? 5),
    product: t.product ?? t.p ?? "",
  };
}

/** Journal cards. Same deal — API posts and the bundled BLOGS entries both land here. */
export function normPost(b: any) {
  if (!b) return null;
  const mins = b.readMinutes ?? parseInt(String(b.d ?? ""), 10);
  return {
    slug: b.slug ?? null,
    title: b.title ?? b.t ?? "",
    excerpt: b.excerpt ?? b.x ?? "",
    category: b.categoryName ?? b.c ?? "Journal",
    readMinutes: Number.isFinite(mins) && mins > 0 ? mins : 5,
    author: b.authorName ?? "",
    publishedAt: b.publishedAt ?? null,
  };
}

export function normOrder(o: any) {
  if (!o) return null;
  return {
    ...o,
    total: toRupees(o.total),
    subtotal: toRupees(o.subtotal),
    items: o.itemCount ?? o.items?.length ?? 0,
    lines: o.items ?? [],
    date: o.placedAt
      ? new Date(o.placedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : o.date,
    status: (o.status ?? "").replace(/_/g, " ").toLowerCase().replace(/^./, (c: string) => c.toUpperCase()),
  };
}

export function normBooking(b: any) {
  if (!b) return null;
  return {
    ...b,
    reference: b.reference,
    puja: b.puja ? { ...b.puja, name: b.puja.name } : { name: "Puja" },
    pandit: b.pandit ? { ...b.pandit, name: b.pandit.displayName ?? b.pandit.name } : null,
    mode: (b.mode ?? "").charAt(0) + (b.mode ?? "").slice(1).toLowerCase(),
    total: toRupees(b.total),
    date: b.scheduledAt ? new Date(b.scheduledAt) : b.date ?? new Date(),
    slot: b.slot,
    statusLabel: (b.status ?? "").replace(/_/g, " ").toLowerCase().replace(/^./, (c: string) => c.toUpperCase()),
  };
}

export { toRupees };
