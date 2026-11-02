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
The server needs a writable `storage/` folder (database, uploaded images, private workshop/request files) — back it up.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run db:generate` | create a migration after changing `db/schema.ts` |
| `npm run db:migrate` | apply migrations |
| `npm run db:seed` | import `data/*.json` into the database (upserts by slug; creates the admin from `.env`) |
| `npm run db:upgrade-content` | one-time, re-runnable content upgrade for the shop structure (see below) |
| `npm run test:features` | WhatsApp links and shop-structure checks |
| `npm run extract` | re-extract `data/*.json` from the static mirror in `theme/` |
| `npm run test:auth` | test customer auth through production HTTP forms with a disposable database; run `npm run build` first |
| `npm run test:permissions` | access rules, and that every admin page, action and download checks a permission |
| `npm run test:access` | test administrator access through production HTTP forms with a disposable database; run `npm run build` first |
| `npm run test:commerce` | coupons, stock, reviews, payment keys and gateway signatures through a production server; run `npm run build` first |
| `npm run test:pwa` | verify private-route and service-worker cache behavior |

## Admin panel (`/admin`)

- **Orders** – list/filter by status, search, CSV export, order details, message the customer on WhatsApp, change status (paid → processing → shipped → completed)
- **Products** – create/edit/delete, prices and sale prices, stock, digital/physical, image upload and ordering, categories, tags, publish/draft
- **Categories / Tags** – add, rename, change slug, delete
- **Pages** – edit the home page and static pages block by block (headings, text, images, buttons, FAQ, videos, product lists)
- **Payments** – choose the active gateway (AmwalPay, Paymob or none) and enter its keys. Secrets are stored encrypted
  (AES-256-GCM, key from `SETTINGS_SECRET` or a generated file in the private storage folder), never shown again and only
  open to owners and administrators. `PAYMOB_*` variables keep working until keys are saved here.
- **Coupons** – percentage or fixed codes with dates, minimum order, total uses and once-per-customer; products only, not shipping
- **Reviews** – reviews from real buyers, published after approval
- **Settings** – store name, logo, contact details, WhatsApp number, social links, shipping fee, menus,
  Print My Design options (fabrics, hoop sizes, fees)
- **Customers** – registered accounts with orders, spend, workshops and requests; search, filters, CSV export;
  edit details, sign out everywhere, suspend or delete an account
- **Team & access** – panel users, roles (Owner, Administrator, Store manager, Sales & support, Content editor,
  Accountant, Viewer, Custom), the access matrix and an activity log of sign-ins and every change made in the panel
- **Search** – the box in the sidebar finds orders, customers, products, workshops, requests and team members,
  limited to the sections the user may open
- **My account** – each user's own profile, password and signed-in devices
- **Requests** – Customized Pattern and Print My Design requests with their uploaded files, status and notes
  (badge in the sidebar for new requests)
- **Finance** – sales (paid orders), costs (product unit costs + recorded purchases), expenses and net profit per
  period, last 12 months, best sellers, CSV export


Access is defined in `lib/permissions.ts`: every section has the level none, view or manage. Pages and Server
Actions call `requireAdmin("orders.view")` / `requireAdmin("orders.manage")` and downloads call `adminCan(...)`; the
menu and read-only views only reflect those checks. `npm run test:permissions` fails if a new page, action or download
skips them. Migration `0004_admin_access` makes every existing admin an Owner. New members get a temporary password
shown once, and can open nothing else until they replace it.

## Shop structure

The main menu has four departments, defined in `lib/catalog.ts` (labels in English and Arabic):

- **Cross Stitch** (`/cross-stitch`): Digital Patterns, Classic Kits, Finished Item Kits, Stitchable Items,
  Free Cross Stitch Pattern (→ `/free-patterns`), Customized Pattern (request form)
- **Hand Embroidery** (`/hand-embroidery`): Digital Patterns, Embroidery Kits, Print My Design (request form)
- **Crochet** (`/crochet`): Digital Patterns, Crochet Kits
- **Online Workshops** (`/workshops`)

Each product section lists the products of its category (e.g. `cross-stitch-classic-kits`): tick the category in
Admin → Products. Empty sections show a "coming soon" page with a WhatsApp button. The home page "What's New"
block fills itself with the 6 newest in-stock products (Admin → Pages → Home, block "What's New").
The Customized Pattern showcase images are the gallery of the `customized-pattern` page in Admin → Pages.
The free pattern PDFs are served from `public/downloads/free-patterns/`; a page button whose link ends in `.pdf`
is shown as a download button.

## Online workshops

A product of type **Online workshop** (Admin → Products) has YouTube videos (private/unlisted links) and
downloadable files (stored in `storage/private`, never public). Workshops can only be bought while signed in;
when the order is paid (Paymob, or status set to paid in the admin) the workshop appears in the customer's
account under **Online Workshops** with the video player and downloads. Access can also be given by hand on the
product page (Participants).

## WhatsApp

All WhatsApp links use `https://wa.me/<number>` built from Settings → WhatsApp number. The old
`wa.me/message/…` short links stopped working when the WhatsApp Business QR code was reset; they are rewritten
everywhere (content, footer, social links).

## Updating an existing database

Before starting this version, rehearse on a **private copy of the current server database first**, then use the explicit maintenance procedure in `deploy/README.md`:

```bash
npm run db:migrate           # adds workshops, requests, finance tables/columns (additive only)
npm run db:upgrade-content   # categories, new menu, WhatsApp links, What's New, Arabic labels
```

`db:upgrade-content` only changes what is still in its old state and never overwrites Arabic texts or
category assignments made in the admin; running it again does nothing.

Access problems from Iraq: see `docs/iraq-access.md`.

Sessions are stored in the database (`sessions` table); passwords are hashed with scrypt.

## Customer accounts

The header links to localized login and registration pages (`/en/login`, `/en/register`, and Arabic equivalents).
Customers can create an account, sign in, edit their details and password at `/en/account/profile`, and sign out.
The site sends no email, so a forgotten password goes through the studio: `/en/forgot-password` opens WhatsApp, and
Admin → Customers → **Create password link** makes a private one-hour, single-use link (only its hash is stored).
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

## Stock

A physical product can have a number of pieces. It goes down when an order is placed and the product sells out at zero;
failed and cancelled orders give their pieces back, and an online payment left unfinished for two hours stops holding them.
Leave the number empty to use only the in-stock switch.

## Self-hosted

Every image, font and script is served by this app: product images live in `public/images`, the Arabic fonts
(IBM Plex Sans Arabic, Aref Ruqaa – OFL) in `app/fonts`, the brand fonts in `public/fonts`. External services are only
contacted for what can't be local: the active payment gateway (Paymob's page, or AmwalPay's SmartBox script on the payment page), Bank Muscat (exchange rates, admin only) and YouTube
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

## Admin Markdown editing

Page body blocks (including hero text, FAQ answers, infoboxes and testimonials), product descriptions,
and internal request notes use a GitHub-style CodeMirror editor with Write/Preview, GFM tables/tasks,
formatting tools, keyboard shortcuts and undo/redo. English and Arabic fields retain their own direction.
URL/email/phone lists and identifiers stay plain inputs. Images can be inserted by existing URL;
the editor does not introduce an upload endpoint or external editing service.

Existing HTML stays byte-for-byte in storage until that field is edited. The editing view converts it
to Markdown; edited values carry an explicit format marker. The public renderer and preview share the
same sanitizer, reject unsafe URL schemes/embeds and display Markdown raw HTML as text. No database
migration or content upgrade is needed for this release. Do not run seed or content upgrade to deploy it.
The admin layout/login no longer show SBC credits; the public footer is unchanged.

A repeated deployment of an already healthy commit is a no-op. Deploying a different commit still
uses a short stop/backup/start window for consistent SQLite storage backups, so requests can briefly
receive 503 during that window. Wait for Actions success before editing production content.
