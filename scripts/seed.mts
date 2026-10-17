// Imports the extracted content (data/*.json) into the database and creates the first admin user.
// Safe to re-run: catalogue/content rows are upserted by slug, existing admins are kept.
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashPassword } from "@/lib/password";
import { normalizeBlock, normalizeMenu, toL } from "@/lib/blocks";
import type { SiteSettings } from "@/db/schema";

const json = <T,>(file: string): T => JSON.parse(fs.readFileSync(`data/${file}`, "utf8"));

type RawProduct = {
  slug: string; name: string; sku: string | null; currency: string; price: number | null; regularPrice: number | null;
  inStock: boolean; digital: boolean; images: string[]; description: string; categories: string[]; tags: string[]; related: string[];
};
type RawTerm = { slug: string; name: string };

const rawProducts = json<RawProduct[]>("products.json");
const rawCategories = json<RawTerm[]>("categories.json");
const rawTags = json<RawTerm[]>("tags.json");
const rawPages = json<{ slug: string; title: string; description: string | null; blocks: [] }[]>("pages.json");
const rawHome = json<{ title: string; blocks: [] }>("home.json");
const rawSite = json<Omit<SiteSettings, "shippingFee" | "currency">>("site.json");

async function upsertTerms(table: typeof schema.categories | typeof schema.tags, terms: RawTerm[]) {
  const ids = new Map<string, number>();
  for (const [i, t] of terms.entries()) {
    const values = table === schema.categories ? { slug: t.slug, name: t.name, sortOrder: i } : { slug: t.slug, name: t.name };
    const [row] = await db
      .insert(table)
      .values(values)
      .onConflictDoUpdate({ target: table.slug, set: { name: t.name } })
      .returning({ id: table.id });
    ids.set(t.slug, row.id);
  }
  return ids;
}

const categoryIds = await upsertTerms(schema.categories, rawCategories);
const tagIds = await upsertTerms(schema.tags, rawTags);

for (const p of rawProducts) {
  const values = {
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    currency: p.currency,
    price: p.price ?? 0,
    regularPrice: p.regularPrice,
    inStock: p.inStock,
    digital: p.digital,
    images: p.images,
    description: p.description,
    related: p.related,
  };
  const [row] = await db
    .insert(schema.products)
    .values(values)
    .onConflictDoUpdate({ target: schema.products.slug, set: values })
    .returning({ id: schema.products.id });

  await db.delete(schema.productCategories).where(eq(schema.productCategories.productId, row.id));
  await db.delete(schema.productTags).where(eq(schema.productTags.productId, row.id));
  const cats = p.categories.map((s) => categoryIds.get(s)).filter((id) => id !== undefined);
  const tgs = p.tags.map((s) => tagIds.get(s)).filter((id) => id !== undefined);
  if (cats.length) await db.insert(schema.productCategories).values(cats.map((categoryId) => ({ productId: row.id, categoryId })));
  if (tgs.length) await db.insert(schema.productTags).values(tgs.map((tagId) => ({ productId: row.id, tagId })));
}

for (const page of [...rawPages.filter((p) => p.slug !== "shop"), { slug: "home", ...rawHome, description: null }]) {
  // extracted content is English; Arabic is filled in from the admin panel
  const values = { slug: page.slug, title: page.title, description: page.description, blocks: (page.blocks as unknown[]).map(normalizeBlock) };
  await db.insert(schema.pages).values(values).onConflictDoUpdate({ target: schema.pages.slug, set: values });
}

const site: SiteSettings = {
  ...rawSite,
  tagline: toL(rawSite.tagline),
  mainMenu: normalizeMenu(rawSite.mainMenu),
  footerMenus: rawSite.footerMenus.map((m) => ({ title: toL(m.title), items: normalizeMenu(m.items) })),
  shippingFee: 0,
  currency: "OMR",
};
await db.insert(schema.settings).values({ key: "site", value: site }).onConflictDoNothing();

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (email && password) {
  const existing = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.email, email) });
  if (!existing) {
    await db.insert(schema.adminUsers).values({ email, name: "Admin", passwordHash: await hashPassword(password) });
    console.log(`admin user created: ${email}`);
  }
} else {
  console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set – no admin user created");
}

console.log(`seeded ${rawProducts.length} products, ${rawCategories.length} categories, ${rawTags.length} tags, ${rawPages.length} pages`);
