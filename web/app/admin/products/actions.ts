"use server";

import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { getAdminT } from "@/lib/i18n/admin-server";
import { revalidateSite } from "@/lib/revalidate";
import { saveImage } from "@/lib/uploads";
import { readL } from "@/components/admin/ui";

export type ProductFormState = { error?: string; ok?: string };

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

  const values = {
    name: name.en,
    nameAr: name.ar,
    slug,
    sku: String(formData.get("sku") ?? "").trim() || null,
    price,
    regularPrice,
    currency: "OMR",
    inStock: formData.get("inStock") === "on",
    digital: formData.get("digital") === "on",
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

  revalidateSite();
  if (!id) redirect(`/admin/products/${productId}?created=1`);
  return { ok: t.products.saved };
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  await db.delete(schema.products).where(eq(schema.products.id, Number(formData.get("id"))));
  revalidateSite();
  redirect("/admin/products");
}
