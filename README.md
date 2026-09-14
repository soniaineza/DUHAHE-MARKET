# 🌿 Duhahe Rwanda Market — Monorepo

End-to-end e-commerce platform for **Duhahe Rwanda Market**: a customer **mobile app** (Expo / React Native), an **admin dashboard** (React), and an **Express REST API**. Fully i18n — **English, Kinyarwanda and French** — with a fresh green organic aesthetic.

Built against the proposal by **Sonia Ineza** for **Esperance Mukabaranga**.

## What's inside

| App | Path | Stack | Purpose |
|-----|------|-------|---------|
| `@duhahe/mobile` | `apps/mobile` | Expo SDK 57 (React Native 0.86) | Customer storefront: 128-product catalog, search (EN/KIN/FR), kg-based cart, checkout, MTN MoMo / Airtel / Cash-on-delivery (stub), order tracking, language switcher |
| `@duhahe/admin` | `apps/admin` | Vite + React + Tailwind v4 | Login, live stats dashboard, order hub (Pending → Packing → In Transit → Delivered), price & stock control, low-stock flags |
| `@duhahe/api` | `apps/api` | Node.js + Express + TypeScript | REST API: catalog, orders, payments (stub gateway), admin auth (JWT), analytics |
| `@duhahe/shared` | `packages/shared` | TypeScript | Shared types, i18n strings, and the full product catalog data |

> **Database:** the API currently runs on a seeded **in-memory store** so everything works now. The store is isolated in `apps/api/src/data/store.ts` so MongoDB/Mongoose (per the proposal) can be swapped in without touching the routes — see *Phase 2*.

## Quick start

Requirements: **Node 18+** (tested on Node 24), npm 10+.

```bash
npm install
```

### 1. Run the API

```bash
npm run api        # http://localhost:4000  (tsx watch, auto-reload)
```

Demo admin login: `admin@duhahe.rw` / `admin123` (change in `apps/api/.env`).

### 2. Run the admin dashboard

```bash
npm run admin      # http://localhost:5173
```

Login with the credentials above. Dashboard shows KPIs, orders by day/status, revenue by category, top products; **Orders** tab advances/cancels orders; **Price & Stock** edits prices, stock levels and toggles items out of stock in one click.

### 3. Run the customer mobile app

```bash
npm run mobile     # Expo dev server (QR code in terminal)
```

Scan the QR with **Expo Go** (Android/iOS) on the same Wi-Fi as your computer. The app auto-detects the dev machine's IP from Expo and talks to the API on port 4000.

**API base URL override** (if auto-detection doesn't fit):

```bash
EXPO_PUBLIC_API_URL=http://192.168.x.x:4000/api npm run mobile
```

### Production builds

```bash
npm run build      # bundles API (dist/server.cjs) + admin (dist ready to host on Vercel/Netlify)
```

API env vars: `apps/api/.env` (see `apps/api/.env.example`). Admin API URL: `apps/admin/.env` → `VITE_API_URL`.

## Feature checklist vs. the 7-week proposal

- ✅ 110+ item catalog (50 staples, 30 vegetables, 30 fruits, 18 kitchenware = **128 items**), searchable in EN/KIN/FR
- ✅ Smart cart with kg / piece / bundle quantities + live price recalculation
- ✅ Checkout with delivery fee logic (Kigali vs. provinces) and payment methods
- ✅ Mobile-first customer app + responsive admin web app
- ✅ Order lifecycle: Pending → Packing → In Transit → Delivered (+ Cancelled), with tracking notes
- ✅ One-click price & stock control, low/out-of-stock flags
- ✅ Business analytics (daily orders, revenue, avg order value, category revenue, top products)
- ✅ Admin authentication (JWT)
- ⏳ Real MTN MoMo and Airtel Money payments (stubbed — see Phase 2)
- ⏳ WhatsApp ordering bot (Phase 2)
- ⏳ Supplier/farmer portal (Phase 2)

## API overview

```
GET  /api/health
GET  /api/categories?lang=kin
GET  /api/products?lang=en&search=ibishyimbo&category=staples&sort=price_asc
GET  /api/products/:id
POST /api/orders/calculate            { items:[{productId,qty}], district }
POST /api/orders                      { items, customer{name,phone,...}, paymentMethod, note? }
GET  /api/orders/:phone/recent
POST /api/payments/stub               { method, orderId, phone, amount }

# Admin (Bearer JWT):
POST /api/admin/auth/login            { email, password }
GET  /api/admin/me
GET  /api/admin/stats
GET  /api/admin/orders
PATCH /api/admin/orders/:id/status    { status, note? }
GET  /api/admin/inventory
PATCH /api/admin/inventory/:id        { price?, stockQty?, organic? }
```

## Phase 2 — Production hardening (next steps)

1. **MongoDB (Mongoose)**: implement repository in `apps/api/src/data/store.ts` behind the same exported functions (`products`, `orders`, `createOrder`, `updateProduct`, …). Add `MONGO_URI` to `.env`. Seed script: `npm run seed`.
2. **MTN MoMo**: fill `MTN_MOMO_*` in `.env` and replace the stub in `apps/api/src/services/paymentService.ts` with the Collection API `requesttopay` call + callback receiver.
3. **Airtel Money**: same pattern via `AIRTEL_*` env vars.
4. **WhatsApp Business Cloud API**: build the ordering bot flow on top of `WA` env vars (menu → cart → order → payment link).
5. **Notifications**: SMS/email alerts on new orders (Webhooks from the admin order update).
6. **Native app release**: run `npx expo prebuild --clean` then build signed binaries for Google Play / App Store (see `app.json` — bundle IDs already set).
7. **Auth for customers**: add OTP sign-in on the mobile app (`auth` strings already in `packages/shared/src/i18n.ts`).
8. **Farmer/supplier portal**: extend the admin with per-farmer batch tracking.

## Repo layout

```
apps/api        Express API + in-memory store + payment stubs
apps/admin      Admin dashboard (Vite + React + Tailwind)
apps/mobile     Customer app (Expo / React Native + react-navigation + i18next)
packages/shared Types, catalog (128 products), EN/KIN/FR translations
```