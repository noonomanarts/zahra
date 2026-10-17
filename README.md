# Zahras Design Studio — Next.js

Next.js 16 (App Router, TypeScript, Tailwind CSS 4) store with its own backend: SQLite database (Drizzle ORM),
admin panel, cart/checkout and Paymob (Oman) payments.

## Setup

Run all commands from the repository root, which contains the Next.js app and `package.json`.

```bash
npm install
cp .env.example .env      # then edit ADMIN_EMAIL / ADMIN_PASSWORD (and Paymob keys when you have them)
npm run db:setup          # creates storage/zahra.db, imports the content, creates the admin user
npm run dev               # http://localhost:3000  ·  admin: http://localhost:3000/admin
```

Production: `npm run build && npm start` (run `npm run db:migrate` on deploy).
The server needs a writable `storage/` folder (database + uploaded images) — back it up.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run db:generate` | create a migration after changing `db/schema.ts` |
| `npm run db:migrate` | apply migrations |
| `npm run db:seed` | import `data/*.json` into the database (upserts by slug; creates the admin from `.env`) |
| `npm run extract` | re-extract `data/*.json` from the static mirror in `theme/` |

## Admin panel (`/admin`)

- **Orders** – list/filter by status, order details, change status (paid → processing → shipped → completed)
- **Products** – create/edit/delete, prices and sale prices, stock, digital/physical, image upload and ordering, categories, tags, publish/draft
- **Categories / Tags** – add, rename, change slug, delete
- **Pages** – edit the home page and static pages block by block (headings, text, images, buttons, FAQ, videos, product lists)
- **Settings** – store name, logo, contact details, social links, shipping fee, menus, admin password

Sessions are stored in the database (`sessions` table); passwords are hashed with scrypt.

## Customer accounts

The header links to localized login and registration pages (`/en/login`, `/en/register`, and Arabic equivalents).
Customers can create an account, sign in, view their name/email at `/en/account`, and sign out.
Customer credentials, sessions and cookies are separate from admin access. Apply pending migrations with
`npm run db:migrate` before using these pages. Existing guest checkout remains available.

Customer passwords use scrypt; sessions use hashed random tokens and a 30-day HTTP-only cookie.
Login/registration attempts are limited per process; deployments with multiple instances should use a shared limiter
and configure their ingress to replace forwarded client-IP headers. Account and authentication pages are never cached
by the service worker; public storefront pages stay static and read header session state through a no-store API.

## Languages (English / Arabic)

- Every storefront URL starts with the language: `/en/...` and `/ar/...` (Arabic is right-to-left).
  `/` redirects using the `lang` cookie, then the browser language.
- UI texts: `lib/i18n/dictionaries.ts` (storefront) and `lib/i18n/admin.ts` (admin panel).
- Content: every product, category, tag, page block, menu item and the tagline has an English and an Arabic
  field in the admin panel. An empty Arabic field falls back to the English text.
- The admin panel has its own language switch (sidebar), stored in the `admin_lang` cookie.

## Currencies

Prices are stored and charged in **OMR**. Visitors can show prices in AED, SAR, QAR, KWD, BHD or IQD
(top bar; saved in the `currency` cookie). Rates (units per 1 OMR) are managed in **Admin → Currencies**:

1. **Fetch rates from Bank Muscat** reads the bank's forex table (mid of buy/sell) and keeps them as pending.
2. Review the change per currency, then **Approve** – only approved rates are used on the site.
3. IQD is not published by Bank Muscat and is set manually (default: official peg, 1,310 IQD per USD).

At checkout the customer sees the total in their currency and the OMR amount that will be charged;
the order stores the display currency and rate.

## Self-hosted

Every image, font and script is served by this app: product images live in `public/images`, the Arabic fonts
(IBM Plex Sans Arabic, Aref Ruqaa – OFL) in `app/fonts`, the brand fonts in `public/fonts`. External services are only
contacted for what can't be local: Paymob (payments), Bank Muscat (exchange rates, admin only) and YouTube
(the About video loads only after the visitor presses play).

## PWA

- Manifest per language: `/en/manifest.webmanifest`, `/ar/manifest.webmanifest` (same app id, name/direction per language,
  shortcuts to shop and cart, screenshots in `public/screenshots`, icons in `public/icons`).
- Service worker `public/sw.js` (production only): pages network-first with offline fallback (`/[lang]/offline`),
  hashed assets cache-first, images/fonts stale-while-revalidate. Admin, API, checkout and account/auth pages are never cached.
  Bump `VERSION` in `sw.js` to reset every visitor's caches.
- `components/pwa/PwaProvider.tsx`: registration, update notice ("new version – refresh") and offline badge.
  Installation is available through the browser menu; automatic install prompts are suppressed.
- Installing requires HTTPS in production (localhost works for testing).

## Payments (Paymob)

Checkout creates the order (prices are always taken from the database), then a Paymob payment intention,
and redirects to Paymob's Unified Checkout. Without Paymob keys, orders are saved as “pending” and paid offline.

1. In the Paymob dashboard get the **secret key**, **public key**, **HMAC secret** and the **integration IDs**, and put them in `.env`.
2. Set the transaction **processed callback** to `https://<your-domain>/api/paymob/webhook`
   and the **response callback** to `https://<your-domain>/checkout/result` (both are also sent with every intention).
3. `PAYMOB_AMOUNT_MULTIPLIER=1000` sends OMR in baisa — confirm with one test payment in Paymob test mode.

Both callbacks are verified with HMAC-SHA512; an order is marked paid only when the signature and the amount match.

## Structure

```
app/(site)/        storefront: home, shop, products, categories, tags, pages, cart, checkout
app/admin/         admin panel
app/api/paymob/    payment webhook
app/uploads/       serves uploaded images from storage/uploads
db/                Drizzle schema, client and migrations
lib/               data access, auth, orders, Paymob, uploads
scripts/           extract (from theme/), migrate, seed
theme/             original static mirror used as the extraction source
```
