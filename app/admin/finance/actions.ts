"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ENTRY_KINDS, type EntryKind } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { FINANCE_CATEGORIES } from "@/lib/finance";
import { getAdminT } from "@/lib/i18n/admin-server";

export type EntryState = { ok?: string; error?: string; key?: number };

export async function addEntry(_prev: EntryState, formData: FormData): Promise<EntryState> {
  await requireAdmin();
  const { t } = await getAdminT();
  const date = String(formData.get("date") ?? "");
  const kind = String(formData.get("kind")) as EntryKind;
  const category = String(formData.get("category"));
  const description = String(formData.get("description") ?? "").trim().slice(0, 200);
  const amount = Number(formData.get("amount"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !ENTRY_KINDS.includes(kind) || !description || !(amount > 0)) {
    return { error: t.finance.invalid };
  }
  await db.insert(schema.financeEntries).values({
    date,
    kind,
    category: (FINANCE_CATEGORIES as readonly string[]).includes(category) ? category : "other",
    description,
    amount: Math.round(amount * 1000) / 1000,
  });
  revalidatePath("/admin/finance");
  return { ok: t.finance.added, key: Date.now() };
}

export async function deleteEntry(formData: FormData) {
  await requireAdmin();
  await db.delete(schema.financeEntries).where(eq(schema.financeEntries.id, Number(formData.get("id"))));
  revalidatePath("/admin/finance");
}
