import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

/** Orders placed while signed in to this account (never matched by email: emails are not verified). */
export async function customerOrders(customerId: number, limit?: number) {
  const query = db.select().from(schema.orders).where(eq(schema.orders.customerId, customerId)).orderBy(desc(schema.orders.createdAt));
  const orders = await (limit ? query.limit(limit) : query);
  if (!orders.length) return [];
  const items = await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, orders.map((o) => o.id)));
  return orders.map((o) => ({ ...o, items: items.filter((i) => i.orderId === o.id) }));
}

export async function customerRequests(customerId: number) {
  return db
    .select({
      number: schema.serviceRequests.number,
      type: schema.serviceRequests.type,
      status: schema.serviceRequests.status,
      createdAt: schema.serviceRequests.createdAt,
    })
    .from(schema.serviceRequests)
    .where(eq(schema.serviceRequests.customerId, customerId))
    .orderBy(desc(schema.serviceRequests.createdAt));
}
