"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { getAdminT } from "@/lib/i18n/admin-server";
import { revalidateSite } from "@/lib/revalidate";
import { readL } from "@/components/admin/ui";

export type TermKind = "categories" | "tags";
export type TermState = { error?: string; ok?: string };

const table = (kind: TermKind) => (kind === "categories" ? schema.categories : schema.tags);

export async function saveTerm(_prev: TermState, formData: FormData): Promise<TermState> {
  const admin = await requireAdmin("taxonomy.manage");
  const { t } = await getAdminT();
  const kind = formData.get("kind") as TermKind;
  const tbl = table(kind);
  const id = Number(formData.get("id")) || null;
  const name = readL(formData, "name");
  const slug = slugify(String(formData.get("slug") ?? "").trim() || name.en);
  if (!name.en || !slug) return { error: t.terms.nameRequired };

  const clash = await db.select({ id: tbl.id }).from(tbl).where(eq(tbl.slug, slug));
  if (clash.some((c) => c.id !== id)) return { error: t.terms.slugTaken(slug) };

  const values = { name: name.en, nameAr: name.ar, slug };
  if (id) await db.update(tbl).set(values).where(eq(tbl.id, id));
  else await db.insert(tbl).values(values);
  await audit(admin, "term.saved", { type: "term", id: id ?? undefined, label: name.en });

  revalidateSite();
  revalidatePath(`/admin/${kind}`);
  return { ok: id ? t.terms.saved : t.terms.added(name.en) };
}

export async function deleteTerm(formData: FormData) {
  const admin = await requireAdmin("taxonomy.manage");
  const kind = formData.get("kind") as TermKind;
  const tbl = table(kind);
  const [removed] = await db.delete(tbl).where(eq(tbl.id, Number(formData.get("id")))).returning({ name: tbl.name });
  if (removed) await audit(admin, "term.deleted", { type: "term", label: removed.name });
  revalidateSite();
  revalidatePath(`/admin/${kind}`);
}
