"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { REVIEW_STATUSES, type ReviewStatus } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { revalidateSite } from "@/lib/revalidate";

export async function moderateReview(formData: FormData) {
  const admin = await requireAdmin("reviews.manage");
  const status = String(formData.get("status")) as ReviewStatus;
  if (!REVIEW_STATUSES.includes(status)) return;
  const id = Number(formData.get("id"));
  const [saved] = await db.update(schema.productReviews).set({ status }).where(eq(schema.productReviews.id, id)).returning({ id: schema.productReviews.id });
  if (saved) await audit(admin, "review.moderated", { type: "review", id, label: `#${id}`, details: { to: status } });
  revalidateSite();
}

export async function deleteReview(formData: FormData) {
  const admin = await requireAdmin("reviews.manage");
  const id = Number(formData.get("id"));
  await db.delete(schema.productReviews).where(eq(schema.productReviews.id, id));
  await audit(admin, "review.deleted", { type: "review", id, label: `#${id}` });
  revalidateSite();
}
