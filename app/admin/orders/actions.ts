"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ORDER_STATUSES, type OrderStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) return;

  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
  if (!order) return;
  await db
    .update(schema.orders)
    .set({ status, ...(status === "paid" && !order.paidAt ? { paidAt: new Date() } : {}) })
    .where(eq(schema.orders.id, id));
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}
