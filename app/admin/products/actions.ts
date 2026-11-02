"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { getAdminT } from "@/lib/i18n/admin-server";
import { revalidateSite } from "@/lib/revalidate";
import { saveImage } from "@/lib/uploads";
import { nextSku } from "@/lib/sku";
import type { ProductKind } from "@/db/schema";
import { readL } from "@/components/admin/ui";

export type ProductFormState = { error?: string; ok?: string; sku?: string };

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
};

/** Products and workshops share these actions; each needs the access of the section it belongs to. */
const manageKind = (kind: ProductKind | undefined) => requireAdmin(kind === "workshop" ? "workshops.manage" : "products.manage");

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const admin = await manageKind(formData.get("kind") === "workshop" ? "workshop" : "product");
  const existingId = num(formData.get("id"));
  if (existingId) await manageKind((await db.query.products.findFirst({ where: eq(schema.products.id, existingId), columns: { kind: true } }))?.kind);
  const { t } = await getAdminT();
  const e = t.products.errors;
  const id = num(formData.get("id"));
  const name = readL(formData, "name");
  const description = readL(formData, "description");
  const slug = slugify(String(formData.get("slug") ?? "").trim() || name.en);
  const price = num(formData.get("price"));
  const regularPrice = num(formData.get("regularPrice"));

  if (!name.en) return { error: e.name };
  if (!slug) return { error: e.slug };
  if (price === null || Number.isNaN(price) || price < 0) return { error: e.price };
  if (regularPrice !== null && (Number.isNaN(regularPrice) || regularPrice <= price)) return { error: e.regular };
  const clash = await db.query.products.findFirst({
    where: id ? and(eq(schema.products.slug, slug), ne(schema.products.id, id)) : eq(schema.products.slug, slug),
  });
  if (clash) return { error: e.slugTaken(slug) };

  const kind: ProductKind = formData.get("kind") === "workshop" ? "workshop" : "product";
  const digital = kind === "workshop" || formData.get("digital") === "on";
  const previous = id ? await db.query.products.findFirst({ where: eq(schema.products.id, id), columns: { sku: true } }) : undefined;
  // an automatic or empty SKU takes the next free number now, so two saves never get the same one
  let sku = String(formData.get("sku") ?? "").trim().slice(0, 40);
  if (formData.get("skuAuto") === "1" || !sku) sku = await nextSku(kind === "workshop" ? "workshop" : digital ? "digital" : "product");
  else if (sku !== previous?.sku) {
    const taken = await db.query.products.findFirst({ where: id ? and(eq(schema.products.sku, sku), ne(schema.products.id, id)) : eq(schema.products.sku, sku) });
    if (taken) return { error: e.skuTaken(sku) };
  }

  let images: string[];
  try {
    images = JSON.parse(String(formData.get("images") ?? "[]"));
    for (const file of formData.getAll("newImages")) {
      if (file instanceof File && file.size > 0) images.push(await saveImage(file));
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : e.upload };
  }

  const unitCost = num(formData.get("unitCost"));
  if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) return { error: e.price };

  const stock = kind === "workshop" || digital ? null : num(formData.get("stock"));
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return { error: e.stock };

  const values = {
    kind,
    unitCost,
    stock,
    name: name.en,
    nameAr: name.ar,
    slug,
    sku,
    price,
    regularPrice,
    currency: "OMR",
    inStock: formData.get("inStock") === "on",
    digital,
    published: formData.get("published") === "on",
    description: description.en,
    descriptionAr: description.ar,
    images,
  };
  const categoryIds = formData.getAll("categories").map(Number);
  const tagIds = formData.getAll("tags").map(Number);

  const productId = await db.transaction(async (tx) => {
    const pid = id
      ? (await tx.update(schema.products).set(values).where(eq(schema.products.id, id)).returning({ id: schema.products.id }))[0]?.id
      : (await tx.insert(schema.products).values(values).returning({ id: schema.products.id }))[0].id;
    if (!pid) return null;
    await tx.delete(schema.productCategories).where(eq(schema.productCategories.productId, pid));
    await tx.delete(schema.productTags).where(eq(schema.productTags.productId, pid));
    if (categoryIds.length) await tx.insert(schema.productCategories).values(categoryIds.map((categoryId) => ({ productId: pid, categoryId })));
    if (tagIds.length) await tx.insert(schema.productTags).values(tagIds.map((tagId) => ({ productId: pid, tagId })));
    return pid;
  });
  if (!productId) return { error: e.notFound };

  await audit(admin, "product.saved", { type: kind, id: productId, label: name.en });
  revalidateSite();
  if (kind === "workshop") revalidatePath("/admin/workshops", "layout");
  // a new workshop continues with its lessons and files
  if (!id) redirect(kind === "workshop" ? `/admin/workshops/${productId}?created=1` : `/admin/products/${productId}?created=1`);
  return { ok: kind === "workshop" ? t.workshops.detailsSaved : t.products.saved, sku };
}

export async function deleteProduct(formData: FormData) {
  const id = Number(formData.get("id"));
  const admin = await manageKind((await db.query.products.findFirst({ where: eq(schema.products.id, id), columns: { kind: true } }))?.kind);
  const [removed] = await db.delete(schema.products).where(eq(schema.products.id, id)).returning({ kind: schema.products.kind, name: schema.products.name });
  if (removed) await audit(admin, "product.deleted", { type: removed.kind, id, label: removed.name });
  revalidateSite();
  redirect(removed?.kind === "workshop" ? "/admin/workshops" : "/admin/products");
}
