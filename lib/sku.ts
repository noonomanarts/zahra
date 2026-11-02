import "server-only";
import { like } from "drizzle-orm";
import { db, schema } from "@/db";

/** SKU series of the shop: P58 (digital patterns), K20 (kits and items), W3 (online workshops). */
export const SKU_PREFIX = { digital: "P", product: "K", workshop: "W" } as const;
export type SkuSeries = keyof typeof SKU_PREFIX;

/** The next free number of a series, after the highest one in use (P58 → P59). */
export async function nextSku(series: SkuSeries) {
  const prefix = SKU_PREFIX[series];
  const rows = await db.select({ sku: schema.products.sku }).from(schema.products).where(like(schema.products.sku, `${prefix}%`));
  const pattern = new RegExp(`^${prefix}(\\d+)$`, "i");
  const highest = rows.reduce((max, r) => Math.max(max, Number(r.sku?.match(pattern)?.[1] ?? 0)), 0);
  return `${prefix}${highest + 1}`;
}

/** Suggestions for the product form, one per series. */
export async function skuSuggestions(): Promise<Record<SkuSeries, string>> {
  const [digital, product, workshop] = await Promise.all([nextSku("digital"), nextSku("product"), nextSku("workshop")]);
  return { digital, product, workshop };
}
