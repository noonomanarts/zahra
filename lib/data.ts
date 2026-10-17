import "server-only";
import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SiteSettings } from "@/db/schema";
import { normalizeBlock, normalizeMenu, toL } from "./blocks";
import { pick, type Locale } from "./i18n/config";
import type { Page, Product, Term } from "./types";

export type { Block, L, MenuItem, Page, Product, Term } from "./types";

const DEFAULT_SITE: SiteSettings = {
  name: "Zahras Design Studio",
  tagline: { en: "", ar: "" },
  logo: null,
  mainMenu: [],
  footerMenus: [],
  social: [],
  contact: { emails: [], phones: [] },
  shippingFee: 0,
  currency: "OMR",
};

export const getSite = cache(async (): Promise<SiteSettings> => {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, "site") });
  const v = { ...DEFAULT_SITE, ...(row?.value as Partial<SiteSettings> | undefined) };
  return {
    ...v,
    tagline: toL(v.tagline),
    mainMenu: normalizeMenu(v.mainMenu),
    footerMenus: (v.footerMenus ?? []).map((m) => ({ title: toL(m.title), items: normalizeMenu(m.items) })),
  };
});

/** Raw catalogue rows with category/tag slugs (small catalogue: loaded once per request). */
const loadCatalogue = cache(async () => {
  const [rows, cats, tgs, pc, pt] = await Promise.all([
    db.select().from(schema.products).orderBy(asc(schema.products.name)),
    db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name)),
    db.select().from(schema.tags).orderBy(asc(schema.tags.name)),
    db.select().from(schema.productCategories),
    db.select().from(schema.productTags),
  ]);
  const catSlug = new Map(cats.map((c) => [c.id, c.slug]));
  const tagSlug = new Map(tgs.map((t) => [t.id, t.slug]));
  const products = rows.map((p) => ({
    ...p,
    categories: pc.filter((x) => x.productId === p.id).map((x) => catSlug.get(x.categoryId)!).filter(Boolean),
    tags: pt.filter((x) => x.productId === p.id).map((x) => tagSlug.get(x.tagId)!).filter(Boolean),
  }));
  const published = products.filter((p) => p.published);
  const count = (key: "categories" | "tags", slug: string) => published.filter((p) => p[key].includes(slug)).length;
  return {
    products,
    categories: cats.map((c) => ({ ...c, count: count("categories", c.slug) })),
    tags: tgs.map((t) => ({ ...t, count: count("tags", t.slug) })),
  };
});

type RawProduct = Awaited<ReturnType<typeof loadCatalogue>>["products"][number];
type RawTerm = { id: number; slug: string; name: string; nameAr: string; count: number };

function localizeProduct(p: RawProduct, lang: Locale): Product {
  const nameI18n = { en: p.name, ar: p.nameAr };
  return {
    id: p.id,
    slug: p.slug,
    name: pick(nameI18n, lang),
    nameI18n,
    sku: p.sku,
    currency: p.currency,
    price: p.price,
    regularPrice: p.regularPrice,
    inStock: p.inStock,
    digital: p.digital,
    published: p.published,
    images: p.images,
    description: pick({ en: p.description, ar: p.descriptionAr }, lang),
    related: p.related,
    categories: p.categories,
    tags: p.tags,
  };
}

function localizeTerm(t: RawTerm, lang: Locale): Term {
  const nameI18n = { en: t.name, ar: t.nameAr };
  return { id: t.id, slug: t.slug, name: pick(nameI18n, lang), nameI18n, count: t.count };
}

// ---------- storefront (published products only) ----------

export async function listProducts(lang: Locale) {
  const { products } = await loadCatalogue();
  return products
    .filter((p) => p.published)
    .map((p) => localizeProduct(p, lang))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
}

export async function getProduct(slug: string, lang: Locale) {
  const p = (await loadCatalogue()).products.find((x) => x.slug === slug && x.published);
  return p && localizeProduct(p, lang);
}

export async function getProducts(slugs: string[], lang: Locale) {
  const all = await listProducts(lang);
  return slugs.map((s) => all.find((p) => p.slug === s)).filter((p): p is Product => !!p);
}

export async function listCategories(lang: Locale): Promise<Term[]> {
  return (await loadCatalogue()).categories.filter((c) => c.count > 0).map((c) => localizeTerm(c, lang));
}

export async function listTags(lang: Locale): Promise<Term[]> {
  return (await loadCatalogue()).tags.filter((t) => t.count > 0).map((t) => localizeTerm(t, lang));
}

export async function getCategory(slug: string, lang: Locale) {
  return (await listCategories(lang)).find((c) => c.slug === slug);
}

export async function getTag(slug: string, lang: Locale) {
  return (await listTags(lang)).find((t) => t.slug === slug);
}

export async function productsInCategory(slug: string, lang: Locale) {
  return (await listProducts(lang)).filter((p) => p.categories.includes(slug));
}

export async function productsWithTag(slug: string, lang: Locale) {
  return (await listProducts(lang)).filter((p) => p.tags.includes(slug));
}

/** Raw page with bilingual blocks (text fields are { en, ar }). */
export const getPageRaw = cache(async (slug: string) => {
  const row = await db.query.pages.findFirst({ where: eq(schema.pages.slug, slug) });
  return (
    row && {
      slug: row.slug,
      title: { en: row.title, ar: row.titleAr },
      description: { en: row.description ?? "", ar: row.descriptionAr ?? "" },
      blocks: row.blocks.map(normalizeBlock),
    }
  );
});

export async function getPage(slug: string, lang: Locale): Promise<Page | undefined> {
  const raw = await getPageRaw(slug);
  return (
    raw && {
      slug: raw.slug,
      title: pick(raw.title, lang),
      description: pick(raw.description, lang) || null,
      blocks: raw.blocks,
    }
  );
}

export async function listPageSlugs() {
  const rows = await db.select({ slug: schema.pages.slug }).from(schema.pages);
  return rows.map((r) => r.slug).filter((s) => s !== "home");
}

// ---------- admin (raw bilingual rows, including unpublished products and empty terms) ----------

export async function adminCatalogue() {
  return loadCatalogue();
}

export type AdminProduct = Awaited<ReturnType<typeof loadCatalogue>>["products"][number];
/** Fields shared by categories and tags in the admin. */
export type AdminTerm = { id: number; slug: string; name: string; nameAr: string; count: number };
