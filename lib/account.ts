import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { PAID_STATUSES } from "./workshops";

/** Orders placed while signed in to this account (never matched by email: emails are not verified). */
export async function customerOrders(customerId: number, limit?: number) {
  const query = db.select().from(schema.orders).where(eq(schema.orders.customerId, customerId)).orderBy(desc(schema.orders.createdAt));
  const orders = await (limit ? query.limit(limit) : query);
  if (!orders.length) return [];
  const items = await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, orders.map((o) => o.id)));
  // orders with something to download get a link in the account
  const productIds = items.flatMap((i) => (i.digital && i.productId ? [i.productId] : []));
  const withFiles = productIds.length ? await db.select({ id: schema.products.id, files: schema.products.digitalFiles }).from(schema.products).where(inArray(schema.products.id, productIds)) : [];
  const delivers = new Set(withFiles.filter((p) => p.files.length).map((p) => p.id));
  return orders.map((o) => {
    const own = items.filter((i) => i.orderId === o.id);
    return { ...o, items: own, hasDownloads: (PAID_STATUSES as readonly string[]).includes(o.status) && own.some((i) => i.productId && delivers.has(i.productId)) };
  });
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
