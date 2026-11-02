"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ORDER_STATUSES, type OrderStatus } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { notifyOrder } from "@/lib/notifications";
import { syncStock } from "@/lib/stock";

export async function updateOrderStatus(formData: FormData) {
  const admin = await requireAdmin("orders.manage");
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) return;

  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
  if (!order) return;
  await syncStock(order, status);
  await db
    .update(schema.orders)
    .set({ status, ...(status === "paid" && !order.paidAt ? { paidAt: new Date() } : {}) })
    .where(eq(schema.orders.id, id));
  if (order.status !== status) {
    await audit(admin, "order.status_changed", { type: "order", id, label: order.number, details: { from: order.status, to: status } });
    if (status === "paid" || status === "shipped" || status === "completed" || status === "cancelled") notifyOrder(id, status, "staff");
  }
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}
