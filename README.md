# Divyaloka

A production-shaped monorepo for a luxury spiritual commerce platform: certified Rudraksha and spiritual goods, plus online/offline puja booking with verified pandits.

```
divyaloka/
├── apps/
│   ├── api/          NestJS + Prisma + PostgreSQL + Redis
│   └── web/          Next.js 15 (App Router, RSC)
├── infra/            Docker Compose + multi-stage Dockerfiles
└── Makefile
```

---

## Run it

Requirements: Node 20+, and Postgres 14+ either via Docker or installed on the host.

```bash
make install     # deps for both apps + prisma generate
make up          # postgres + redis
make deploy      # apply the committed migrations
make seed        # catalogue, pujas, pandits, demo accounts
make dev         # api on :4000, web on :3000
```

Or the whole stack in containers:

```bash
docker compose -f infra/docker-compose.yml up --build
```

### Without Docker

If Postgres is already installed on the machine, skip `make up`:

```bash
make install
make db-create   # creates the divyaloka role + database
make deploy      # apply the committed migrations
make seed
make dev
```

`make db-create` connects as the `postgres` superuser and is safe to re-run —
it reports "already exists" and carries on. If your server asks for a password,
set `PGPASSWORD` first, or create the role and database by hand:

```sql
CREATE ROLE divyaloka WITH LOGIN PASSWORD 'divyaloka' CREATEDB;
CREATE DATABASE divyaloka OWNER divyaloka;
```

Redis is optional — leave `REDIS_URL` commented out and the API falls back to an
in-process cache. Set it only when a Redis server is actually running, because a
`REDIS_URL` pointing at a dead port fails every cached read.

### Moving to another machine

The schema travels, the data does not. `apps/api/prisma/migrations/` is committed,
so `make deploy` rebuilds all 42 tables identically anywhere. `make seed` then loads
the demo catalogue — but it **wipes every table first**, so never run it on a database
holding real orders. To carry actual data across, use `pg_dump` instead:

```bash
pg_dump -U divyaloka -h 127.0.0.1 divyaloka > divyaloka.sql   # source machine
psql   -U divyaloka -h 127.0.0.1 -d divyaloka -f divyaloka.sql # target machine
```

`.env` files are gitignored and never travel. On each new machine copy
`apps/api/.env.example` → `apps/api/.env` and `apps/web/.env.example` → `apps/web/.env.local`.

| URL | What |
|---|---|
| http://localhost:3000 | Storefront |
| http://localhost:3000/puja | Book Puja |
| http://localhost:3000/admin | Admin console |
| http://localhost:3000/pandit | Pandit console |
| http://localhost:4000/api/docs | Swagger |
| http://localhost:4000/api/health | Health check |

Copy `apps/api/.env.example` → `.env` and `apps/web/.env.example` → `.env.local`. The defaults work against the Docker services with no edits.

### Demo accounts (password `divyaloka123`)

| Role | Login |
|---|---|
| Super admin | admin@divyaloka.com |
| Support | support@divyaloka.com |
| Puja coordinator | puja@divyaloka.com |
| Pandit | pandit4@divyaloka.com (Pt. Vinayak Sharma, Bareilly) |
| Customer | aarav@example.com, or OTP on 9876543210 |

In development the OTP endpoint returns the code in its response (`devCode`), so you can sign in without an SMS gateway. It is stripped in production.

### Paying without a gateway

`POST /api/payments/intent` creates a sandbox provider order, then `POST /api/payments/sandbox/settle` marks it captured — which runs the same code path the real webhook does: stock decrements, invoice issues, points credit, cart clears, booking confirms. The endpoint refuses to run when `NODE_ENV=production`.

---

## What is actually built

### Backend (`apps/api`)

Fourteen modules, 40 Prisma models. The parts worth pointing at:

**Money is integer paise everywhere.** No floats touch a price. `common/money.ts` holds the conversions and the inclusive-GST extraction used on invoices.

**Stock is reserved, not deducted, at checkout.** `orders.create` opens a transaction, writes the order, and increments `Inventory.reserved` line by line. Only `markPaid` — called from the verified webhook — decrements `onHand`, issues the invoice, credits loyalty points, consumes the coupon and empties the cart. A failed payment calls `releaseReservation` and the stock goes straight back. This is why a card decline never silently eats inventory.

**Two customers cannot take the same muhurat.** `puja.createBooking` runs `SELECT … FOR UPDATE` on the `Availability` row inside a transaction, flips it to `HELD` for 15 minutes, then creates the booking as `PENDING_PAYMENT`. The unique constraint on `(panditId, date, slot)` backs it at the database level rather than in application logic. A cron sweeps holds that never got paid and puts the slot back on sale.

**Webhooks are signed and idempotent.** Razorpay signatures are HMAC-SHA256 over the *raw* body (preserved by a `json({ verify })` hook in `main.ts`) and compared with `timingSafeEqual`. Every event is upserted into `WebhookEvent` keyed on `(provider, eventId)`, so gateway retries are no-ops.

**Refresh tokens rotate, and reuse revokes the family.** Presenting an already-rotated token means it leaked, so the entire token family is revoked rather than just that one token.

**Reviews come only from buyers.** `reviews.create` checks for a paid `OrderItem` (or a `COMPLETED` booking) before it will accept anything, and one per person per product. Approval recomputes the product and pandit aggregates, which is what keeps the `AggregateRating` in the page's structured data honest.

**Product photography is data, not a deploy.** The admin uploads through `POST /catalog/products/:id/media`; `StorageService` writes the file (local disk under `UPLOAD_DIR`, served at `/uploads/*`, or straight to S3 once real credentials are present) and stores only the key, with the URL derived at read time. Uploads are validated by MIME type and size, and the stored filename is always ours — a client-supplied name is untrusted input. Deleting a row deletes the file.

**The cart is keyed by `x-session-id` or the signed-in user.** The web client mints a session id and sends it as a header, which survives the API being on another domain where a third-party cookie would not. Cart routes run `OptionalJwtAuthGuard`, so the same request binds to an account when there is one, and `auth` merges the guest cart on sign-in — a bag filled before logging in follows the shopper through checkout.

**Anything that moves sellable stock drops the catalogue cache.** Reserving at checkout, decrementing on payment, releasing a failed hold, an admin stock adjustment and a product edit all call `catalog.invalidate`. Sellable stock is `onHand - reserved`; leaving that cached is how a shop oversells.

**Every admin mutation writes an audit row** with actor, entity and a JSON diff. Refunds above ₹5,000 refuse a `SUPPORT` role and need a manager.

Scheduled work lives in `puja.scheduler.ts`: hold expiry every minute, T-48h and T-2h reminders every thirty, booking close-out hourly, abandoned-cart recovery hourly.

### Frontend (`apps/web`)

The storefront, Book Puja wizard, account, admin console and pandit console, split into typed client modules and wired to the API through `lib/api.ts`.

**Nothing is invented client-side.** There is no bundled catalogue, no local coupon table and no offline cart. Prices, stock, categories, pujas, pandits and discounts are read from the API or not shown at all — a shop that quotes a number the database did not confirm is worse than a shop that says it cannot reach the server, which is exactly what it now says. Calls are still fail-soft with a timeout, but a failure yields an empty state, never a plausible-looking substitute.

**Prices and stock are read per request.** `/`, `/shop`, `/product/[slug]` and `/puja` render dynamically and their catalogue fetches are `no-store`, so an admin edit is live on the next page load. Content that carries no price — the journal, static pages, banners — keeps its ISR window.

Product imagery is a photograph when one has been uploaded and generated SVG (`components/art.tsx`) when it has not — beads drawn with real mukhi lines, malas as 108-bead rings, garments and yantras as geometry. `ProductArt` picks between them, and falls back to the artwork if the image itself fails to load, so a half-photographed catalogue still looks finished and a shopper never meets a torn-image icon.

**SEO / GEO.** Product pages emit `Product` + `Offer` + `AggregateRating` + `BreadcrumbList`; the puja page emits `FAQPage` + `Service`; contact emits `LocalBusiness`; the layout emits `Organization`. Sitemap and robots are generated routes. `/verify/{number}` is a public certificate lookup, so a buyer — or an assistant asked "is this certificate real" — has a URL that resolves. `public/llms.txt` states plainly what we can be cited for.

---

## Every screen, and what it actually calls

| Screen | Control | Endpoint |
|---|---|---|
| Home | product grids | `GET /catalog/products` |
| Shop | category / mukhi / price / stock filters, sort | `GET /catalog/products` |
| Product | add to bag, buy now | `POST /cart/items` |
| Product | wishlist heart | `POST /users/me/wishlist` |
| Product | apply coupon | `POST /cart/coupon` |
| Product | write review, ask question | `POST /reviews`, `POST /reviews/questions/:id` |
| Product | reviews, related, certificates | `GET /catalog/products/:slug` |
| Cart | quantity, remove, gift wrap, coupon | `PATCH|DELETE /cart/items/:id`, `POST /cart/gift-wrap`, `POST /cart/coupon` |
| Login | send OTP, verify, email, Google | `POST /auth/otp/request`, `/otp/verify`, `/login`, `/google` |
| Checkout | address book, add address | `GET|POST /users/me/addresses` |
| Checkout | redeem points, pay | `POST /orders` → `POST /payments/intent` → settle |
| Book Puja | puja list, pandit availability, live quote | `GET /puja/pujas`, `/puja/pandits?date=&language=`, `/puja/quote` |
| Book Puja | hold muhurat and pay | `POST /puja/bookings` → payment |
| Account | orders, tracking, returns | `GET /orders`, `/orders/:n/track`, `POST /orders/:n/return` |
| Account | bookings, cancel, reschedule | `GET /puja/bookings`, `POST .../cancel`, `.../reschedule` |
| Account | wishlist, addresses, points, referrals, tickets | `/users/me/*` |
| Pandit | schedule, requests, accept/decline | `GET /pandit/schedule`, `/requests`, `POST /requests/:id/accept` |
| Pandit | availability grid, services, profile, payout | `POST /pandit/availability`, `/services`, `PATCH /pandit/profile`, `POST /pandit/payouts` |
| Admin | dashboard, revenue chart, category mix | `GET /admin/dashboard` |
| Admin | order pack/ship/deliver/refund | `PATCH /orders/admin/:id/status`, `POST .../refunds/:id/approve` |
| Admin | product create/edit/archive | `POST|DELETE /catalog/products` |
| Admin | stock adjust, customer block | `PATCH /admin/inventory/:id`, `/admin/customers/:id/block` |
| Admin | assign pandit, approve pandit, commission | `POST /admin/bookings/:id/assign`, `/admin/pandits/:id/approve` |
| Admin | coupon create/pause, review moderation | `POST /coupons`, `POST /reviews/admin/:id/moderate` |
| Admin | homepage sections, audit log, settings | `POST /content/home-sections`, `GET /admin/audit`, `/admin/settings` |
| /verify/:number | certificate lookup | `GET /catalog/verify/:number` |

Two design decisions hold this together.

**One money boundary.** The API stores integer paise; the UI was written in rupees. `lib/normalise.ts` converts exactly once, at the edge, so a live catalogue can never render at 100× the real price.

**Fail-soft, and honest about it.** Every call has an 8-second timeout and a fallback. With the API down the storefront still browses on bundled data and a corner notice says so; sign-in, checkout and booking say plainly that they need the server rather than pretending to succeed. Server validation messages are shown verbatim — "That muhurat was just taken", "Only 2 left in stock" — instead of being replaced with a generic failure.

---

## Verification status

Run in this environment before delivery:

| Check | Result |
|---|---|
| `apps/api` — npm install | 364 packages, clean |
| `apps/api` — `tsc --noEmit` | passes across all modules |
| `apps/web` — `tsc --noEmit` | passes |
| `apps/web` — `next build` | passes end to end, 17 routes |
| `prisma migrate` / `generate` | run against Postgres 18 — 42 tables created from `20260819103948_init` |
| `npm run seed` | 21 categories, 24 products, 12 pujas, 6 pandits, 10 users |
| API boot | `Database connected`, all routes mapped, `/api/health` reports `db: up` |
| Product create + edit round-trip | verified in Postgres — all 22 fields persist, edits preserve untouched columns |
| Coupon edit | verified — value, caps, limits, expiry and active state all persist |

The schema, the migration and the seed have now been run against a live Postgres.
Still unexercised end to end: the booking slot-hold lock, the payment webhook path,
and refunds — those need a real gateway round trip rather than the sandbox settle.

---

## Not built

Named plainly, so nothing reads as done when it is not:

- **S3 uploads.** Product media upload, storage, listing, reordering and deletion are built and run on local disk. `StorageService` has the S3 branch behind the same interface, but it needs `npm i @aws-sdk/client-s3` in `apps/api` and real credentials before it will run — with none set the driver stays local. `Certificate.fileKey` still has no upload path.
- **Invoice and receipt PDFs.** `Invoice` rows are created with real numbers; rendering to PDF is a stub.
- **Notification providers.** `NotificationsService` has the fan-out, templates and channel routing. SES, MSG91 and WhatsApp Cloud API calls are stubbed and log in development — drop in credentials and the four methods.
- **Shiprocket.** Shipment rows, AWBs and status transitions exist; the carrier API call is not wired.
- **Meilisearch.** Search runs on Postgres `ILIKE`, which is fine to a few thousand SKUs and will need replacing after that.
- **Multi-currency and Hindi content.** `hreflang` is declared, the copy is not translated.
- **Tests.** Vitest is configured; no suites written. The booking lock and the webhook handler are where I would start.
- **Guest checkout.** The cart works signed-out and merges into the account on sign-in, but placing the order itself still requires an account.
- **Blog article pages.** `/blog` lists posts from the API; individual `/blog/[slug]` routes are not built.

## Next

1. `prisma generate`, migrate, seed, and walk one order and one booking end to end.
2. Write the two tests that matter: concurrent bookings on one slot, and a replayed webhook.
3. Wire S3 and the notification providers — that closes most of the gap to a real launch.
