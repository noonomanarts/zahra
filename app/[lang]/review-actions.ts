"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCustomer } from "@/lib/customer-auth";
import { canReview } from "@/lib/reviews";

export type ReviewState = { error?: "signIn" | "notBuyer" | "rating" | "body"; saved?: boolean };

/** One review per buyer and product; editing it sends it back for approval. */
export async function submitReview(productId: number, _prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const customer = await getCustomer();
  if (!customer) return { error: "signIn" };
  const product = await db.query.products.findFirst({ where: eq(schema.products.id, productId), columns: { id: true, kind: true } });
  if (!product || !(await canReview(customer.id, product.id, product.kind))) return { error: "notBuyer" };
  const rating = Number(formData.get("rating"));
  if (![1, 2, 3, 4, 5].includes(rating)) return { error: "rating" };
  const body = String(formData.get("body") ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
  if (body.length < 3 || body.length > 1000) return { error: "body" };
  await db.insert(schema.productReviews)
    .values({ productId, customerId: customer.id, rating, body })
    .onConflictDoUpdate({ target: [schema.productReviews.productId, schema.productReviews.customerId], set: { rating, body, status: "pending", updatedAt: new Date() } });
  revalidatePath("/admin/reviews");
  return { saved: true };
}
