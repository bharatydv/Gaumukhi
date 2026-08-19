"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Shop, Header, Footer, CartDrawer, SearchOverlay, FloatingHelp } from "./shell";
import { I } from "./art";
import { api, payFor } from "../lib/api";
import { normOrder, normBooking, normProducts, normCategories, toRupees } from "../lib/normalise";

/** route key → URL, so child components keep calling S.go("shop", { cat }) unchanged. */
const ROUTES: Record<string, string> = {
  home: "/", shop: "/shop", puja: "/puja", checkout: "/checkout", login: "/login",
  account: "/account", blog: "/blog", about: "/about", contact: "/contact",
  admin: "/admin", pandit: "/pandit",
};

/**
 * One store for the whole app.
 *
 * Cart, wishlist, coupons and auth are the server's to decide — there is no local
 * mirror of any of them. A price, a discount or a stock figure the database has not
 * confirmed is never shown, because a bag that adds up to one number here and another
 * at checkout is worse than a bag that refuses to open. When the API is unreachable
 * `S.online` is false and the affected actions say so instead of pretending.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [online, setOnline] = useState(false);
  const [ready, setReady] = useState(false);

  const [product, setProduct] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);
  const [serverTotals, setServerTotals] = useState<any>(null);
  const [wish, setWish] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; t: string; bad?: boolean }[]>([]);
  const [user, setUser] = useState<any>(null);
  const [coupon, setCoupon] = useState<string | null>(null);
  const [giftWrap, setGiftWrapState] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  // Nav categories come from the database so a new category appears in the menu
  // as soon as it is created in the admin panel.
  const [categories, setCategories] = useState<any[]>([]);

  const toast = useCallback((t: string, bad = false) => {
    const id = Math.random();
    setToasts((x) => [...x, { id, t, bad }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 3600);
  }, []);

  /** Normalises a server cart into the shape every component already expects. */
  const absorbCart = useCallback((data: any) => {
    if (!data) return;
    setCartId(data.id);
    setServerTotals(
      data.totals
        ? Object.fromEntries(Object.entries(data.totals).map(([k, v]) => [k, toRupees(v as number)]))
        : null,
    );
    setCoupon(data.coupon ?? null);
    setGiftWrapState(!!data.giftWrap);
    setCart(
      (data.items ?? []).map((i: any) => ({
        key: i.id,
        id: i.productId,
        slug: i.slug,
        name: i.name,
        category: i.category,
        kind: i.artKind,
        tone: i.artTone,
        image: i.image ?? null,
        mukhi: i.mukhi,
        price: toRupees(i.unitPrice),
        mrp: toRupees(i.mrp),
        qty: i.qty,
        stock: i.stock,
      })),
    );
  }, []);

  // Boot: find out whether the API is up, and restore session + cart if so.
  useEffect(() => {
    (async () => {
      const health = await api.health();
      const up = !!health;
      setOnline(up);

      if (up) {
        const [me, serverCart] = await Promise.all([api.me(), api.cart()]);
        if (me) {
          setUser(me);
          const [w, o, b] = await Promise.all([api.wishlist(), api.myOrders(), api.myBookings()]);
          setWish((w ?? []).map((p: any) => p.id));
          setOrders((o ?? []).map(normOrder));
          setBookings((b ?? []).map(normBooking));
        }
        absorbCart(serverCart);
      }

      const cats = await api.categories();
      setCategories(normCategories(cats ?? []));

      setReady(true);
    })();
  }, [absorbCart]);

  const refreshAccount = useCallback(async () => {
    if (!online) return;
    const [me, o, b, w] = await Promise.all([api.profile(), api.myOrders(), api.myBookings(), api.wishlist()]);
    if (me) setUser(me);
    setOrders((o ?? []).map(normOrder));
    setBookings((b ?? []).map(normBooking));
    setWish((w ?? []).map((p: any) => p.id));
  }, [online]);

  const params = useMemo(() => Object.fromEntries(search?.entries() ?? []), [search]);

  const route = useMemo(() => {
    const hit = Object.entries(ROUTES).find(([, path]) => path === pathname);
    if (hit) return hit[0];
    return pathname?.startsWith("/product") ? "product" : "home";
  }, [pathname]);

  // Line prices come from the server cart; the discount is whatever the coupon
  // engine awarded. Nothing is recomputed here — the server is the only authority
  // on what this bag costs.
  const subtotal = serverTotals?.subtotal ?? cart.reduce((s, l) => s + l.price * l.qty, 0);
  const discount = serverTotals?.discount ?? 0;

  const S: any = {
    theme, route, params, product, cart, cartId, wish, recent, user,
    userName: user?.name || user?.email || null,
    coupon, discount, subtotal, giftWrap, orders, bookings, online, ready,
    totals: serverTotals,
    cartCount: cart.reduce((s, l) => s + l.qty, 0),
    setCartOpen, setSearch: setSearchOpen, toast, setProduct, refreshAccount,

    toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")),

    go: (r: string, p: Record<string, string> = {}) => {
      const q = new URLSearchParams(p).toString();
      router.push((ROUTES[r] ?? "/") + (q ? `?${q}` : ""));
    },

    openProduct: (p: any) => {
      setProduct(p);
      setRecent((r) => [p, ...r.filter((x) => x.id !== p.id)].slice(0, 8));
      router.push(`/product/${p.slug}`);
    },

    // ── cart ───────────────────────────────────────────────────
    add: async (p: any, qty = 1) => {
      if (p.stock === 0) { toast("Out of stock — we will notify you on restock", true); return; }

      if (!online) { toast("Cannot reach the server, so your bag cannot be saved yet", true); return; }

      const res = await api.addToCart(String(p.id), qty);
      if (!res.ok) { toast(res.message!, true); return; }
      absorbCart(res.data);
      setCartOpen(true);
      toast(`${p.name} added to your bag`);
    },

    setQty: async (key: string, q: number) => {
      if (!online) { toast("Cannot reach the server, so your bag cannot be changed", true); return; }
      const res = q <= 0 ? await api.removeCartItem(key) : await api.setCartQty(key, q);
      if (!res.ok) { toast(res.message!, true); return; }
      absorbCart(res.data);
    },

    setGiftWrap: async (on: boolean) => {
      setGiftWrapState(on);
      if (online) {
        const res = await api.setGiftWrap(on);
        if (res.ok) absorbCart(res.data);
      }
    },

    applyCoupon: async (code: string) => {
      if (!code?.trim()) { toast("Enter a coupon code first", true); return false; }

      // Only the coupon engine decides whether a code is live, what it is worth and
      // whether this cart qualifies. Guessing here is how a paused coupon keeps paying out.
      if (!online) { toast("Cannot reach the server to check that code", true); return false; }

      const res = await api.applyCoupon(code.trim().toUpperCase());
      if (!res.ok) { toast(res.message!, true); return false; }
      absorbCart(res.data);
      toast(`${code.toUpperCase()} applied`);
      return true;
    },

    removeCoupon: async () => {
      setCoupon(null);
      if (online) {
        const res = await api.removeCoupon();
        if (res.ok) absorbCart(res.data);
      }
    },

    // ── wishlist ───────────────────────────────────────────────
    toggleWish: async (id: any) => {
      const on = wish.includes(id);
      setWish((w) => (on ? w.filter((x) => x !== id) : [...w, id]));

      if (online && user) {
        const res = await api.toggleWishlist(String(id));
        if (!res.ok) {
          setWish((w) => (on ? [...w, id] : w.filter((x) => x !== id))); // roll back
          toast(res.message!, true);
          return;
        }
        toast(res.data?.saved ? "Saved to wishlist" : "Removed from wishlist");
        return;
      }
      toast(on ? "Removed from wishlist" : "Saved to wishlist");
    },

    // ── auth ───────────────────────────────────────────────────
    requestOtp: async (phone: string) => {
      if (!online) { toast("Sign-in needs the server. Start the API and try again.", true); return null; }
      const res = await api.requestOtp(phone);
      if (!res.ok) { toast(res.message!, true); return null; }
      toast(`Code sent to +91 ${phone}`);
      return res.data;
    },

    verifyOtp: async (phone: string, code: string) => {
      const res = await api.verifyOtp(phone, code);
      if (!res.ok) { toast(res.message!, true); return false; }
      await refreshAccount();
      const me = await api.me();
      setUser(me);
      toast(`Signed in as ${me?.name || phone}`);
      router.push("/account");
      return true;
    },

    loginEmail: async (email: string, password: string) => {
      if (!online) { toast("Sign-in needs the server. Start the API and try again.", true); return false; }
      const res = await api.login(email, password);
      if (!res.ok) { toast(res.message!, true); return false; }
      const me = await api.me();
      setUser(me);
      await refreshAccount();
      toast(`Signed in as ${me?.name || email}`);
      router.push("/account");
      return true;
    },

    loginGoogle: async (idToken: string) => {
      const res = await api.google(idToken);
      if (!res.ok) { toast(res.message!, true); return false; }
      const me = await api.me();
      setUser(me);
      await refreshAccount();
      toast(`Signed in as ${me?.name || "Sadhak"}`);
      router.push("/account");
      return true;
    },

    logout: async () => {
      await api.logout();
      setUser(null);
      setWish([]);
      setOrders([]);
      setBookings([]);
      toast("Signed out");
      router.push("/");
    },

    // ── checkout ───────────────────────────────────────────────
    /** Creates the order, pays it, then refreshes the account. Returns the order or null. */
    placeOrder: async (addressId: string, pointsToUse = 0) => {
      if (!online) { toast("Checkout needs the server. Start the API and try again.", true); return null; }
      if (!user) { toast("Sign in to complete your order", true); router.push("/login"); return null; }

      const created = await api.createOrder(addressId, pointsToUse);
      if (!created.ok) { toast(created.message!, true); return null; }

      const paid = await payFor({ orderId: created.data.id });
      if (!paid.ok) {
        toast(paid.message || "Payment did not complete. Your bag is untouched.", true);
        return null;
      }

      const fresh = await api.cart();
      absorbCart(fresh);
      await refreshAccount();
      toast(`Order ${created.data.number} confirmed`);
      return created.data;
    },

    // ── puja ───────────────────────────────────────────────────
    createBooking: async (payload: any) => {
      if (!online) { toast("Booking needs the server. Start the API and try again.", true); return null; }
      if (!user) { toast("Sign in to hold a muhurat", true); router.push("/login"); return null; }

      const created = await api.createBooking(payload);
      if (!created.ok) { toast(created.message!, true); return null; }

      const paid = await payFor({ bookingId: created.data.id });
      if (!paid.ok) {
        toast(paid.message || "Payment did not complete. The slot has been released.", true);
        return null;
      }

      const confirmed = await api.booking(created.data.reference);
      await refreshAccount();
      toast(`Booking ${created.data.reference} confirmed`);
      return confirmed ?? created.data;
    },

    cancelBooking: async (reference: string, reason: string) => {
      const res = await api.cancelBooking(reference, reason);
      if (!res.ok) { toast(res.message!, true); return null; }
      await refreshAccount();
      toast(res.data?.message ?? "Booking cancelled");
      return res.data;
    },

    rescheduleBooking: async (reference: string, date: string, slot: string) => {
      const res = await api.rescheduleBooking(reference, date, slot);
      if (!res.ok) { toast(res.message!, true); return false; }
      await refreshAccount();
      toast("Booking moved. A fresh confirmation is on its way.");
      return true;
    },

    // ── misc ───────────────────────────────────────────────────
    addBooking: (b: any) => setBookings((x) => [b, ...x]),

    categories,
    normProducts,
  };

  const chrome = !["admin", "pandit"].includes(route);

  return (
    <Shop.Provider value={S}>
      <div className="dv" data-theme={theme}>
        {chrome && <Header />}
        {children}
        {chrome && <Footer />}
        {chrome && <FloatingHelp />}
        {cartOpen && <CartDrawer />}
        {searchOpen && <SearchOverlay />}

        {ready && !online && (
          <div
            role="status"
            style={{
              position: "fixed", left: 16, bottom: 16, zIndex: 80, maxWidth: 300,
              background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
              padding: "11px 14px", fontSize: ".78rem", color: "var(--ink-2)", boxShadow: "var(--shadow)",
            }}
          >
            <b style={{ color: "var(--ink)" }}>Server unreachable</b>
            <br />
            Prices, stock and offers could not be loaded. Nothing shown is priced &mdash; the bag, checkout and
            booking stay closed until the connection is back.
          </div>
        )}

        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className="toast" style={t.bad ? { background: "#8E2F35" } : undefined}>
              {t.bad ? I.x : I.check}
              {t.t}
            </div>
          ))}
        </div>
      </div>
    </Shop.Provider>
  );
}
