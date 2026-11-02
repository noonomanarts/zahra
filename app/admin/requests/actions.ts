"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { REQUEST_STATUSES, type RequestStatus } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";

export type RequestFormState = { ok?: string; error?: string };

export async function updateRequest(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const admin = await requireAdmin("requests.manage");
  const { t } = await getAdminT();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as RequestStatus;
  if (!REQUEST_STATUSES.includes(status)) return { error: "Invalid status." };
  const [saved] = await db
    .update(schema.serviceRequests)
    .set({ status, adminNotes: String(formData.get("adminNotes") ?? "").slice(0, 5000) })
    .where(eq(schema.serviceRequests.id, id))
    .returning({ number: schema.serviceRequests.number });
  if (saved) await audit(admin, "request.updated", { type: "request", id, label: saved.number });
  revalidatePath("/admin", "layout");
  return { ok: t.requests.saved };
}
