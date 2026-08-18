/**
 * Typed client for the NestJS API.
 *
 * Two rules hold everywhere:
 *  1. Every call is fail-soft with a timeout. If the API is down the UI degrades
 *     to bundled seed data instead of erroring, and a slow API never holds a render.
 *  2. Mutations return { ok, message } so the caller can show the server's own
 *     wording rather than inventing its own.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 8000);

type Json = Record<string, any>;

export interface Result<T> {
  ok: boolean;
  data: T | null;
  message?: string;
  status?: number;
}

/** Read helper — returns the payload or the fallback, never throws. */
async function get<T>(path: string, fallback: T | null = null, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      credentials: "include",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "Content-Type": "application/json" },
      next: { revalidate } as any,
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/** Write helper — surfaces the server's validation message so the UI can show it verbatim. */
async function send<T>(path: string, method: string, body?: Json): Promise<Result<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "include",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const message = Array.isArray(payload?.message)
        ? payload.message[0]
        : payload?.message || "That did not go through. Try again.";
      return { ok: false, data: null, message, status: res.status };
    }
    return { ok: true, data: payload as T, status: res.status };
  } catch (e: any) {
    const offline = e?.name === "TimeoutError" || e?.name === "AbortError";
    return {
      ok: false,
      data: null,
      message: offline ? "The server is not responding. Working offline." : "Network error. Check your connection.",
      status: 0,
    };
  }
}

const qs = (q: Json) =>
  new URLSearchParams(
    Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string][],
  ).toString();

export const api = {
  // ── catalog ──────────────────────────────────────────────────
  categories: () => get<Array<{ group: string; items: any[] }>>("/catalog/categories", null, 300),
  products: (q: Json = {}) => {
    const s = qs(q);
    return get<{ items: any[]; nextCursor: string | null }>(`/catalog/products${s ? `?${s}` : ""}`);
  },
  product: (slug: string) => get<any>(`/catalog/products/${slug}`, null, 600),
  verifyCertificate: (number: string) => get<any>(`/catalog/verify/${number}`, null, 3600),

  // ── auth ─────────────────────────────────────────────────────
  requestOtp: (phone: string) => send<{ sent: boolean; devCode?: string }>("/auth/otp/request", "POST", { phone }),
  verifyOtp: (phone: string, code: string, referralCode?: string) =>
    send<any>("/auth/otp/verify", "POST", { phone, code, referralCode }),
  register: (email: string, password: string, name?: string) =>
    send<any>("/auth/register", "POST", { email, password, name }),
  login: (email: string, password: string) => send<any>("/auth/login", "POST", { email, password }),
  google: (idToken: string) => send<any>("/auth/google", "POST", { idToken }),
  logout: () => send("/auth/logout", "POST"),
  me: () => get<any>("/auth/me", null, 0),

  // ── account ──────────────────────────────────────────────────
  profile: () => get<any>("/users/me", null, 0),
  updateProfile: (b: Json) => send<any>("/users/me", "PATCH", b),
  addresses: () => get<any[]>("/users/me/addresses", [], 0),
  addAddress: (b: Json) => send<any>("/users/me/addresses", "POST", b),
  updateAddress: (id: string, b: Json) => send<any>(`/users/me/addresses/${id}`, "PATCH", b),
  removeAddress: (id: string) => send(`/users/me/addresses/${id}`, "DELETE"),
  wishlist: () => get<any[]>("/users/me/wishlist", [], 0),
  toggleWishlist: (productId: string) => send<{ saved: boolean }>("/users/me/wishlist", "POST", { productId }),
  points: () => get<{ balance: number; entries: any[] }>("/users/me/points", null, 0),
  referrals: () => get<any>("/users/me/referrals", null, 0),
  tickets: () => get<any[]>("/users/me/tickets", [], 0),
  createTicket: (b: Json) => send<any>("/users/me/tickets", "POST", b),
  notifications: () => get<any[]>("/users/me/notifications", [], 0),

  // ── cart ─────────────────────────────────────────────────────
  cart: () => get<any>("/cart", null, 0),
  addToCart: (productId: string, qty = 1, variantId?: string) =>
    send<any>("/cart/items", "POST", { productId, qty, variantId }),
  setCartQty: (itemId: string, qty: number) => send<any>(`/cart/items/${itemId}`, "PATCH", { qty }),
  removeCartItem: (itemId: string) => send<any>(`/cart/items/${itemId}`, "DELETE"),
  applyCoupon: (code: string) => send<any>("/cart/coupon", "POST", { code }),
  removeCoupon: () => send<any>("/cart/coupon", "DELETE"),
  setGiftWrap: (enabled: boolean) => send<any>("/cart/gift-wrap", "POST", { enabled }),

  // ── orders ───────────────────────────────────────────────────
  createOrder: (addressId: string, pointsToUse = 0) => send<any>("/orders", "POST", { addressId, pointsToUse }),
  myOrders: () => get<any[]>("/orders", [], 0),
  order: (number: string) => get<any>(`/orders/${number}`, null, 0),
  track: (number: string) => get<any>(`/orders/${number}/track`, null, 0),
  requestReturn: (number: string, reason: string) => send<any>(`/orders/${number}/return`, "POST", { reason }),

  // ── payments ─────────────────────────────────────────────────
  paymentIntent: (b: { orderId?: string; bookingId?: string; provider?: string }) =>
    send<any>("/payments/intent", "POST", b),
  settleSandbox: (paymentId: string) => send<any>("/payments/sandbox/settle", "POST", { paymentId }),

  // ── puja ─────────────────────────────────────────────────────
  pujas: () => get<any[]>("/puja/pujas", null, 300),
  pandits: (q: Json = {}) => {
    const s = qs(q);
    return get<any[]>(`/puja/pandits${s ? `?${s}` : ""}`, null, 0);
  },
  quote: (q: Json) => get<any>(`/puja/quote?${qs(q)}`, null, 0),
  createBooking: (b: Json) => send<any>("/puja/bookings", "POST", b),
  myBookings: () => get<any[]>("/puja/bookings", [], 0),
  booking: (reference: string) => get<any>(`/puja/bookings/${reference}`, null, 0),
  rescheduleBooking: (reference: string, date: string, slot: string) =>
    send<any>(`/puja/bookings/${reference}/reschedule`, "POST", { date, slot }),
  cancelBooking: (reference: string, reason: string) =>
    send<any>(`/puja/bookings/${reference}/cancel`, "POST", { reason }),

  // ── reviews & questions ──────────────────────────────────────
  reviews: (productId: string) => get<any[]>(`/reviews/product/${productId}`, [], 0),
  createReview: (b: Json) => send<any>("/reviews", "POST", b),
  questions: (productId: string) => get<any[]>(`/reviews/questions/${productId}`, [], 60),
  askQuestion: (productId: string, body: string) => send<any>(`/reviews/questions/${productId}`, "POST", { body }),

  // ── content ──────────────────────────────────────────────────
  posts: (take = 12) => get<any[]>(`/content/posts?take=${take}`, null, 600),
  post: (slug: string) => get<any>(`/content/posts/${slug}`, null, 600),
  page: (slug: string) => get<any>(`/content/pages/${slug}`, null, 600),
  banners: (placement?: string) => get<any[]>(`/content/banners${placement ? `?placement=${placement}` : ""}`, null, 300),
  homeSections: () => get<any[]>("/content/home-sections", null, 300),
  sitemap: () => get<{ products: any[]; categories: any[]; posts: any[] }>("/content/sitemap", null, 3600),

  // ── pandit console ───────────────────────────────────────────
  panditProfile: () => get<any>("/pandit/profile", null, 0),
  updatePanditProfile: (b: Json) => send<any>("/pandit/profile", "PATCH", b),
  panditServices: (pujaIds: string[]) => send<any>("/pandit/services", "POST", { pujaIds }),
  panditAvailability: (from: string, to: string) => get<any[]>(`/pandit/availability?from=${from}&to=${to}`, [], 0),
  setPanditAvailability: (entries: Array<{ date: string; slots: string[]; open: boolean }>) =>
    send<any>("/pandit/availability", "POST", { entries }),
  panditSchedule: (from?: string, to?: string) =>
    get<any[]>(`/pandit/schedule${from ? `?from=${from}&to=${to}` : ""}`, [], 0),
  panditRequests: () => get<any[]>("/pandit/requests", [], 0),
  acceptRequest: (id: string) => send<any>(`/pandit/requests/${id}/accept`, "POST"),
  declineRequest: (id: string, reason?: string) => send<any>(`/pandit/requests/${id}/decline`, "POST", { reason }),
  panditIncome: () => get<any>("/pandit/income", null, 0),
  requestPayout: () => send<any>("/pandit/payouts", "POST"),

  // ── admin console ────────────────────────────────────────────
  dashboard: () => get<any>("/admin/dashboard", null, 0),
  adminProducts: (q?: string) => get<any[]>(`/catalog/admin/products${q ? `?q=${encodeURIComponent(q)}` : ""}`, [], 0),
  saveProduct: (b: Json) => send<any>("/catalog/products", "POST", b),
  archiveProduct: (id: string) => send<any>(`/catalog/products/${id}`, "DELETE"),
  saveCategory: (b: Json) => send<any>("/catalog/categories", "POST", b),
  adminOrders: (q: Json = {}) => get<any[]>(`/orders/admin/all?${qs(q)}`, [], 0),
  setOrderStatus: (id: string, status: string) => send<any>(`/orders/admin/${id}/status`, "PATCH", { status }),
  approveRefund: (id: string) => send<any>(`/orders/admin/refunds/${id}/approve`, "POST"),
  adminCustomers: (q?: string) => get<any[]>(`/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`, [], 0),
  blockCustomer: (id: string, blocked: boolean) => send<any>(`/admin/customers/${id}/block`, "PATCH", { blocked }),
  adminInventory: () => get<any[]>("/admin/inventory", [], 0),
  adjustStock: (id: string, onHand: number) => send<any>(`/admin/inventory/${id}`, "PATCH", { onHand }),
  adminBookings: (status?: string) => get<any[]>(`/admin/bookings${status ? `?status=${status}` : ""}`, [], 0),
  assignPandit: (bookingId: string, panditId: string) =>
    send<any>(`/admin/bookings/${bookingId}/assign`, "POST", { panditId }),
  adminPandits: (status?: string) => get<any[]>(`/admin/pandits${status ? `?status=${status}` : ""}`, [], 0),
  approvePandit: (id: string, approve: boolean) => send<any>(`/admin/pandits/${id}/approve`, "POST", { approve }),
  setCommission: (id: string, commissionPct: number) =>
    send<any>(`/admin/pandits/${id}/commission`, "PATCH", { commissionPct }),
  coupons: () => get<any[]>("/coupons", [], 0),
  createCoupon: (b: Json) => send<any>("/coupons", "POST", b),
  updateCoupon: (id: string, b: Json) => send<any>(`/coupons/${id}`, "PATCH", b),
  pendingReviews: () => get<any[]>("/reviews/admin/pending", [], 0),
  moderateReview: (id: string, approve: boolean) => send<any>(`/reviews/admin/${id}/moderate`, "POST", { approve }),
  savePost: (b: Json) => send<any>("/content/posts", "POST", b),
  savePage: (b: Json) => send<any>("/content/pages", "POST", b),
  saveBanner: (b: Json) => send<any>("/content/banners", "POST", b),
  reorderHome: (sections: any[]) => send<any>("/content/home-sections", "POST", { sections }),
  auditLog: (take = 50) => get<any[]>(`/admin/audit?take=${take}`, [], 0),
  settings: () => get<any>("/admin/settings", null, 0),
  setSetting: (key: string, value: unknown) => send<any>("/admin/settings", "POST", { key, value }),

  health: () => get<any>("/health", null, 0),
};

/**
 * Runs the full pay flow: create the gateway intent, then settle.
 * In production this hands off to the Razorpay SDK and the webhook confirms
 * server-side; in sandbox we call the settle endpoint directly so the same
 * downstream path (stock, invoice, points, confirmation) executes either way.
 */
export async function payFor(target: { orderId?: string; bookingId?: string }): Promise<Result<any>> {
  const intent = await api.paymentIntent({ ...target, provider: "razorpay" });
  if (!intent.ok || !intent.data) return intent;

  const live =
    typeof window !== "undefined" &&
    (window as any).Razorpay &&
    String(intent.data.keyId || "").startsWith("rzp_live");

  if (live) {
    return new Promise((resolve) => {
      const rzp = new (window as any).Razorpay({
        key: intent.data.keyId,
        order_id: intent.data.providerOrderId,
        amount: intent.data.amount,
        currency: intent.data.currency,
        name: "Divyaloka",
        handler: () => resolve({ ok: true, data: { pending: true } }),
        modal: { ondismiss: () => resolve({ ok: false, data: null, message: "Payment cancelled." }) },
      });
      rzp.open();
    });
  }

  return api.settleSandbox(intent.data.paymentId);
}

export async function getProducts(query: Json = {}) {
  const res = await api.products(query);
  return res?.items ?? null;
}
