"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { revalidateSite } from "@/lib/revalidate";
import { UploadError, deletePrivateFile, savePrivateFile } from "@/lib/uploads";
import { youtubeId } from "@/lib/workshops";
import type { WorkshopFile, WorkshopVideo } from "@/lib/types";

export type ContentState = { error?: string; ok?: string; files?: WorkshopFile[]; at?: number };
export type GrantState = { error?: string; ok?: string };

async function findWorkshop(id: number) {
  const product = Number.isInteger(id) ? await db.query.products.findFirst({ where: eq(schema.products.id, id) }) : undefined;
  return product?.kind === "workshop" ? product : undefined;
}

/** Lessons (YouTube links, in order) and the private downloads of one workshop. */
export async function saveWorkshopContent(_prev: ContentState, formData: FormData): Promise<ContentState> {
  await requireAdmin();
  const { t } = await getAdminT();
  const e = t.workshops.errors;
  const workshop = await findWorkshop(Number(formData.get("id")));
  if (!workshop) return { error: e.notFound };

  let videos: WorkshopVideo[];
  let kept: { id: string; name: string }[];
  try {
    videos = (JSON.parse(String(formData.get("videos") ?? "[]")) as WorkshopVideo[])
      .map((v) => ({ title: { en: String(v.title?.en ?? "").trim(), ar: String(v.title?.ar ?? "").trim() }, url: String(v.url ?? "").trim() }))
      .filter((v) => v.url || v.title.en || v.title.ar);
    kept = (JSON.parse(String(formData.get("files") ?? "[]")) as { id: string; name: string }[]).map((f) => ({ id: String(f.id), name: String(f.name ?? "").trim() }));
  } catch {
    return { error: e.video };
  }
  if (videos.some((v) => !youtubeId(v.url))) return { error: e.video };

  // existing files in the order chosen in the editor, with their (possibly renamed) titles
  const previous = new Map(workshop.workshopFiles.map((f) => [f.id, f]));
  const files: WorkshopFile[] = kept.flatMap((k) => {
    const f = previous.get(k.id);
    return f ? [{ ...f, name: (k.name || f.name).slice(0, 120) }] : [];
  });
  const keptIds = new Set(files.map((f) => f.id));
  const removed = workshop.workshopFiles.filter((f) => !keptIds.has(f.id));

  const uploaded: WorkshopFile[] = [];
  for (const file of formData.getAll("newFiles")) {
    if (!(file instanceof File) || file.size === 0) continue;
    try {
      const stored = await savePrivateFile(file, "workshops", { maxBytes: 25 * 1024 * 1024, types: [".pdf", ".zip", ".jpg", ".jpeg", ".png", ".webp"] });
      uploaded.push({ id: crypto.randomUUID().slice(0, 8), name: file.name.slice(0, 120), file: stored, size: file.size });
    } catch (err) {
      // nothing is saved, so files stored by this attempt are removed again
      await Promise.all(uploaded.map((f) => deletePrivateFile(f.file)));
      return { error: err instanceof UploadError ? e.file(file.name) : e.upload };
    }
  }

  const all = [...files, ...uploaded];
  await db.update(schema.products).set({ workshopVideos: videos, workshopFiles: all }).where(eq(schema.products.id, workshop.id));
  await Promise.all(removed.map((f) => deletePrivateFile(f.file)));

  revalidateSite();
  revalidatePath("/admin/workshops", "layout");
  return { ok: t.workshops.saved, files: all, at: Date.now() };
}

/** Access given by hand (paid in person, gift, replacement…). */
export async function grantWorkshop(_prev: GrantState, formData: FormData): Promise<GrantState> {
  await requireAdmin();
  const { t } = await getAdminT();
  const w = t.workshops;
  const workshop = await findWorkshop(Number(formData.get("productId")));
  if (!workshop) return { error: w.errors.notFound };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const customer = email ? await db.query.customers.findFirst({ where: eq(schema.customers.email, email) }) : undefined;
  if (!customer) return { error: w.noCustomer };
  const added = await db
    .insert(schema.workshopGrants)
    .values({ customerId: customer.id, productId: workshop.id })
    .onConflictDoNothing()
    .returning({ id: schema.workshopGrants.customerId });
  revalidatePath("/admin/workshops", "layout");
  return added.length ? { ok: w.granted(customer.name) } : { ok: w.already(customer.name) };
}

/** One-click access for a paid guest order whose email matches a customer account. */
export async function linkGuestOrder(formData: FormData) {
  await requireAdmin();
  const workshop = await findWorkshop(Number(formData.get("productId")));
  const customerId = Number(formData.get("customerId"));
  if (!workshop || !Number.isInteger(customerId)) return;
  await db.insert(schema.workshopGrants).values({ customerId, productId: workshop.id }).onConflictDoNothing();
  revalidatePath("/admin/workshops", "layout");
}

export async function revokeWorkshop(formData: FormData) {
  await requireAdmin();
  await db
    .delete(schema.workshopGrants)
    .where(and(eq(schema.workshopGrants.productId, Number(formData.get("productId"))), eq(schema.workshopGrants.customerId, Number(formData.get("customerId")))));
  revalidatePath("/admin/workshops", "layout");
}
