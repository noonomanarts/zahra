// One-time content upgrade for the new shop structure (safe to re-run – every step checks first):
// section categories, new main menu, WhatsApp links, the automatic "What's New" home section and the
// Customized Pattern showcase page. Run after `npm run db:migrate`: `npm run db:upgrade-content`.
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SiteSettings } from "@/db/schema";
import { ARABIC_GLOSSARY } from "@/lib/arabic-glossary";
import { normalizeBlock, normalizeMenu, toL } from "@/lib/blocks";
import { DEFAULT_PRINT_SERVICE, DEPARTMENTS, SECTION_CATEGORIES, SERVICE_PATHS, WORKSHOPS_LABEL, WORKSHOPS_PATH, defaultMainMenu } from "@/lib/catalog";
import type { Block, L, MenuItem } from "@/lib/types";

const log = (...args: unknown[]) => console.log("•", ...args);

/** Fills an empty Arabic text from the glossary; returns true when something changed. */
let translated = 0;
function arabic(text: L | undefined) {
  const ar = text && !text.ar?.trim() ? ARABIC_GLOSSARY[text.en.trim()] ?? ARABIC_GLOSSARY[text.en] : undefined;
  if (!text || !ar) return false;
  text.ar = ar;
  translated++;
  return true;
}
const arabicMenu = (items: MenuItem[]): boolean => items.map((m) => [arabic(m.label), arabicMenu(m.children ?? [])].some(Boolean)).some(Boolean);
const shortLink = () => /https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/message\/[A-Za-z0-9]+[^"'\s<\\]*/g;

// ---------- 1. categories for the department sections ----------

const existing = await db.select().from(schema.categories);
let order = Math.max(0, ...existing.map((c) => c.sortOrder)) + 1;
for (const c of SECTION_CATEGORIES) {
  if (existing.some((e) => e.slug === c.slug)) continue;
  await db.insert(schema.categories).values({ slug: c.slug, name: c.name.en, nameAr: c.name.ar, sortOrder: order++ });
  log("category created:", c.slug);
}

// ---------- 2. first assignment of the existing catalogue (only into section categories that are still empty) ----------

const categories = await db.select().from(schema.categories);
const catId = new Map(categories.map((c) => [c.slug, c.id]));
const products = await db.select().from(schema.products);
const links = await db.select().from(schema.productCategories);
const slugsOf = (productId: number) =>
  links.filter((l) => l.productId === productId).map((l) => categories.find((c) => c.id === l.categoryId)?.slug ?? "");

const PATTERN_THEMES = ["islamic-patterns", "other-patterns", "palestinian-patterns", "ramadan-eid-patterns"];
const finishedItem = (slug: string) => /pillow-cover|shawl/.test(slug);
const isKit = (cats: string[]) => cats.includes("beginners-kits") || cats.includes("advance-kits");
const rules: Record<string, (p: (typeof products)[number], cats: string[]) => boolean> = {
  "cross-stitch-digital-patterns": (p, cats) => p.digital && cats.some((c) => PATTERN_THEMES.includes(c)),
  "cross-stitch-classic-kits": (p, cats) => !p.digital && isKit(cats) && !finishedItem(p.slug),
  "cross-stitch-finished-item-kits": (p, cats) => !p.digital && isKit(cats) && finishedItem(p.slug),
  "cross-stitch-stitchable-items": (_, cats) => cats.includes("accessories"),
};
for (const [slug, rule] of Object.entries(rules)) {
  const id = catId.get(slug)!;
  if (links.some((l) => l.categoryId === id)) continue; // already curated in the admin
  const matches = products.filter((p) => p.kind === "product" && rule(p, slugsOf(p.id)));
  if (matches.length) {
    await db.insert(schema.productCategories).values(matches.map((p) => ({ productId: p.id, categoryId: id }))).onConflictDoNothing();
  }
  log(`${slug}: ${matches.length} products assigned`);
}

// ---------- 3. site settings: menus, WhatsApp, Print My Design options ----------

const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, "site") });
const site = row?.value as SiteSettings | undefined;
const digits = (site?.whatsapp || site?.contact?.phones?.[0] || "").replace(/\D/g, "");

if (site) {
  let changed = false;
  const mainMenu = normalizeMenu(site.mainMenu);
  if (!mainMenu.some((m) => m.href === `/${DEPARTMENTS[0].slug}`)) {
    // links the studio added itself are kept; About, Shop and Contact are part of the new menu
    const replaced = new Set(["#", "/shop", "/about-us", "/contact-us"]);
    const menu: MenuItem[] = defaultMainMenu();
    menu.splice(menu.length - 1, 0, ...mainMenu.filter((m) => !replaced.has(m.href)));
    site.mainMenu = menu;
    changed = true;
    log("main menu: “Shop” replaced by", DEPARTMENTS.map((d) => d.label.en).join(", "), "and Online Workshops");
  }

  const footer = (site.footerMenus ?? []).map((m) => ({ title: toL(m.title), items: normalizeMenu(m.items) }));
  const shopMenu = footer.find((m) => /shop/i.test(m.title.en));
  if (shopMenu && !shopMenu.items.some((i) => i.href === `/${DEPARTMENTS[0].slug}`)) {
    const keep = shopMenu.items.filter((i) => ["/handmade-products", "/accessories-products", "/free-patterns"].includes(i.href));
    shopMenu.items = [...DEPARTMENTS.map((d) => ({ label: d.label, href: `/${d.slug}` })), { label: WORKSHOPS_LABEL, href: WORKSHOPS_PATH }, ...keep];
    site.footerMenus = footer;
    changed = true;
    log("footer “Shop” menu updated");
  }

  if (digits && !site.whatsapp) {
    site.whatsapp = digits;
    changed = true;
    log("WhatsApp number set:", digits);
  }
  if (digits && site.social?.some((s) => shortLink().test(s.href))) {
    site.social = site.social.map((s) => ({ ...s, href: s.href.replace(shortLink(), `https://wa.me/${digits}`) }));
    changed = true;
    log("social WhatsApp link fixed");
  }
  if (!site.printService) {
    site.printService = DEFAULT_PRINT_SERVICE;
    changed = true;
    log("Print My Design options added – set the fabric names and fees in Admin → Settings");
  }
  site.mainMenu = normalizeMenu(site.mainMenu);
  site.footerMenus = (site.footerMenus ?? []).map((m) => ({ title: toL(m.title), items: normalizeMenu(m.items) }));
  site.tagline = toL(site.tagline);
  if ([arabicMenu(site.mainMenu), ...site.footerMenus.map((m) => [arabic(m.title), arabicMenu(m.items)].some(Boolean)), arabic(site.tagline)].some(Boolean)) {
    changed = true;
  }
  if (changed) await db.update(schema.settings).set({ value: site }).where(eq(schema.settings.key, "site"));
}

// ---------- 4. page content ----------

/** Replaces the hand-picked “Best Sellers” (or first product) section with the automatic one. */
function upgradeHome(blocks: Block[]): Block[] {
  const whatsNew: Block[] = [
    { type: "heading", level: 2, text: { en: "What's New", ar: "وصل حديثًا" } },
    { type: "new-arrivals", limit: 6 },
  ];
  const heading = (b: Block | undefined) => (b?.type === "heading" ? b.text.en : "");
  const pairs = blocks.flatMap((b, i) => (b.type === "heading" && blocks[i + 1]?.type === "products" ? [b] : []));
  const target = pairs.find((b) => /best\s*sell/i.test(heading(b))) ?? pairs.find((b) => !/what.?s new/i.test(heading(b))) ?? pairs[0];
  const out = [...blocks];
  // the old hand-picked “What's New” list would repeat the new section
  for (const b of pairs) {
    if (b !== target && /what.?s new/i.test(heading(b))) out.splice(out.indexOf(b), 2);
  }
  const at = target ? out.indexOf(target) : -1;
  if (at >= 0) out.splice(at, 2, ...whatsNew);
  else out.splice(Math.max(1, out.findIndex((b) => b.type === "heading")), 0, ...whatsNew);
  return out;
}

const pages = await db.select().from(schema.pages);
for (const page of pages) {
  const before = JSON.stringify(page.blocks);
  let json = before;
  if (digits) {
    json = json.replace(shortLink(), `https://wa.me/${digits}`);
    // "join our WhatsApp list Click here" on the About page had no link
    json = json.replace(/(WhatsApp list )Click here(?! ?<\/a>)/, `$1<a href=\\"https://wa.me/${digits}\\">Click here</a>`);
  }
  // the custom pattern FAQ pointed to the old form on the Digital Patterns page
  json = json.replace('<a href=\\"/digital-patterns\\">Please fill this form</a>', `<a href=\\"${SERVICE_PATHS["custom-pattern"]}\\">Please fill this form</a>`);
  if (json !== before) log(`${page.slug}: links fixed`);
  let blocks = (JSON.parse(json) as unknown[]).map(normalizeBlock);

  // Digital Patterns: the old "Order Customized Pattern" contact form now links to its own page
  const formAt = blocks.findIndex((b) => b.type === "contact-form");
  const previous = blocks[formAt - 1];
  if (page.slug === "digital-patterns" && formAt > 0 && previous?.type === "heading" && /custom/i.test(previous.text.en)) {
    blocks.splice(
      formAt,
      1,
      {
        type: "text",
        html: {
          en: "<p>Would you like a pattern made just for you? Tell us your idea and we will send you a quote on WhatsApp.</p>",
          ar: "<p>هل ترغب بنموذج مصمم خصيصًا لك؟ أخبرنا بفكرتك وسنرسل لك عرض السعر عبر واتساب.</p>",
        },
      },
      { type: "button", text: { en: "Request a customized pattern", ar: "اطلب نموذجًا حسب الطلب" }, href: SERVICE_PATHS["custom-pattern"] },
    );
    log("digital-patterns: the customized pattern form now links to its own page");
  }

  if (page.slug === "home" && !blocks.some((b) => b.type === "new-arrivals")) {
    blocks = upgradeHome(blocks);
    log("home: “What's New” is now automatic (6 newest in-stock products)");
  }

  for (const b of blocks) {
    if (b.type === "heading") arabic(b.text);
    if (b.type === "button") arabic(b.text);
    if (b.type === "counter") arabic(b.label);
    if (b.type === "infobox") arabic(b.title);
    if (b.type === "text") arabic(b.html);
    if (b.type === "hero") [b.title, b.subtitle, b.html, b.button?.text].forEach((x) => arabic(x));
  }
  const titleAr = !page.titleAr.trim() ? ARABIC_GLOSSARY[page.title] : undefined;
  if (titleAr) {
    await db.update(schema.pages).set({ titleAr }).where(eq(schema.pages.id, page.id));
    translated++;
  }

  if (JSON.stringify(blocks) !== before) await db.update(schema.pages).set({ blocks }).where(eq(schema.pages.id, page.id));
}

// ---------- 5. Customized Pattern showcase (edited in Admin → Pages) ----------

if (!pages.some((p) => p.slug === "customized-pattern")) {
  const source = pages.find((p) => p.slug === "digital-patterns")?.blocks.find((b) => b.type === "gallery");
  await db.insert(schema.pages).values({
    slug: "customized-pattern",
    title: "Customized Pattern – showcase",
    titleAr: "نموذج حسب الطلب – معرض الأعمال",
    description: "Images shown at the top of the Customized Pattern page.",
    blocks: [{ type: "gallery", images: source?.type === "gallery" ? source.images.slice(0, 9) : [] }],
  });
  log("customized-pattern page created – replace the gallery with patterns made for customers");
}

if (translated) log(`${translated} Arabic texts filled in (menus, titles, headings, buttons)`);
console.log("content is up to date");
