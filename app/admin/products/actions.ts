"use server";

import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { getAdminT } from "@/lib/i18n/admin-server";
import { revalidateSite } from "@/lib/revalidate";
import { UploadError, deletePrivateFile, savePrivateFile, saveImage } from "@/lib/uploads";
import { youtubeId } from "@/lib/workshops";
import type { WorkshopFile, WorkshopVideo } from "@/lib/types";
import type { ProductKind } from "@/db/schema";
import { readL } from "@/components/admin/ui";

export type ProductFormState = { error?: string; ok?: string; workshopFiles?: WorkshopFile[] };

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
};

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireAdmin();
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

  let images: string[];
  try {
    images = JSON.parse(String(formData.get("images") ?? "[]"));
    for (const file of formData.getAll("newImages")) {
      if (file instanceof File && file.size > 0) images.push(await saveImage(file));
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : e.upload };
  }

  const kind: ProductKind = formData.get("kind") === "workshop" ? "workshop" : "product";
  const unitCost = num(formData.get("unitCost"));
  if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) return { error: e.price };

  // workshop content: videos (YouTube links) and private downloadable files
  let workshopVideos: WorkshopVideo[] = [];
  let workshopFiles: WorkshopFile[] = [];
  const previous = id ? await db.query.products.findFirst({ where: eq(schema.products.id, id) }) : undefined;
  const removedFiles: WorkshopFile[] = [];
  try {
    workshopVideos = (JSON.parse(String(formData.get("workshopVideos") ?? "[]")) as WorkshopVideo[])
      .map((v) => ({ title: { en: String(v.title?.en ?? "").trim(), ar: String(v.title?.ar ?? "").trim() }, url: String(v.url ?? "").trim() }))
      .filter((v) => v.url || v.title.en || v.title.ar);
    const kept = new Set((JSON.parse(String(formData.get("workshopFiles") ?? "[]")) as WorkshopFile[]).map((f) => f.id));
    workshopFiles = (previous?.workshopFiles ?? []).filter((f) => kept.has(f.id));
    removedFiles.push(...(previous?.workshopFiles ?? []).filter((f) => !kept.has(f.id)));
  } catch {
    return { error: e.video };
  }
  if (workshopVideos.some((v) => !youtubeId(v.url))) return { error: e.video };
  for (const file of formData.getAll("newWorkshopFiles")) {
    if (!(file instanceof File) || file.size === 0) continue;
    try {
      const stored = await savePrivateFile(file, "workshops", { maxBytes: 25 * 1024 * 1024, types: [".pdf", ".zip", ".jpg", ".png", ".webp"] });
      workshopFiles.push({ id: crypto.randomUUID().slice(0, 8), name: file.name.slice(0, 120), file: stored, size: file.size });
    } catch (err) {
      return { error: err instanceof UploadError ? e.file(file.name) : e.upload };
    }
  }

  const values = {
    kind,
    unitCost,
    workshopVideos,
    workshopFiles,
    name: name.en,
    nameAr: name.ar,
    slug,
    sku: String(formData.get("sku") ?? "").trim() || null,
    price,
    regularPrice,
    currency: "OMR",
    inStock: formData.get("inStock") === "on",
    digital: kind === "workshop" || formData.get("digital") === "on",
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
  await Promise.all(removedFiles.map((f) => deletePrivateFile(f.file)));

  revalidateSite();
  if (!id) redirect(`/admin/products/${productId}?created=1`);
  return { ok: t.products.saved, workshopFiles };
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  await db.delete(schema.products).where(eq(schema.products.id, Number(formData.get("id"))));
  revalidateSite();
  redirect("/admin/products");
}

/** Workshop access given by hand (paid in person, gift…). */
export async function grantWorkshop(formData: FormData) {
  await requireAdmin();
  const productId = Number(formData.get("productId"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const customer = email ? await db.query.customers.findFirst({ where: eq(schema.customers.email, email) }) : undefined;
  if (!customer) redirect(`/admin/products/${productId}?grant=missing#participants`);
  await db.insert(schema.workshopGrants).values({ customerId: customer.id, productId }).onConflictDoNothing();
  redirect(`/admin/products/${productId}?grant=ok#participants`);
}

export async function revokeWorkshop(formData: FormData) {
  await requireAdmin();
  const productId = Number(formData.get("productId"));
  await db
    .delete(schema.workshopGrants)
    .where(and(eq(schema.workshopGrants.productId, productId), eq(schema.workshopGrants.customerId, Number(formData.get("customerId")))));
  redirect(`/admin/products/${productId}#participants`);
}
