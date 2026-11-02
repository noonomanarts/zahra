import "server-only";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";

type StockOrder = { id: number; status: string; stockReserved: boolean };
const ENDED = ["failed", "cancelled"];
const ABANDONED_AFTER = 2 * 3600_000;

async function returnPieces(orderId: number) {
  await db.transaction(async (tx) => {
    // the flag is taken inside the transaction, so pieces can't be returned twice
    const [order] = await tx.update(schema.orders).set({ stockReserved: false }).where(and(eq(schema.orders.id, orderId), eq(schema.orders.stockReserved, true))).returning({ id: schema.orders.id });
    if (!order) return;
    for (const item of await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId))) {
      if (!item.productId || item.digital) continue;
      await tx.update(schema.products).set({ stock: sql`${schema.products.stock} + ${item.quantity}` }).where(and(eq(schema.products.id, item.productId), isNotNull(schema.products.stock)));
    }
  });
}

/**
 * Keeps counted stock right when an order changes status: failed and cancelled orders give their pieces back, and an
 * order that comes back to life takes them again. A sale that was already paid is never refused, so that can't go below 0.
 */
export async function syncStock(order: StockOrder, next: string) {
  if (ENDED.includes(next)) return returnPieces(order.id);
  if (order.stockReserved || !(ENDED.includes(order.status) || order.status === "pending")) return;
  await db.transaction(async (tx) => {
    for (const item of await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id))) {
      if (!item.productId || item.digital) continue;
      await tx.update(schema.products).set({ stock: sql`max(${schema.products.stock} - ${item.quantity}, 0)` }).where(and(eq(schema.products.id, item.productId), isNotNull(schema.products.stock)));
    }
    await tx.update(schema.orders).set({ stockReserved: true }).where(eq(schema.orders.id, order.id));
  });
}

/** Online payments left unfinished stop holding the last pieces. Orders awaiting a manual payment keep theirs. */
export async function releaseAbandonedOrders() {
  const stale = await db.select({ id: schema.orders.id }).from(schema.orders).where(and(
    eq(schema.orders.status, "pending"),
    eq(schema.orders.stockReserved, true),
    isNotNull(schema.orders.paymentReference),
    lt(schema.orders.createdAt, new Date(Date.now() - ABANDONED_AFTER)),
  ));
  await Promise.all(stale.map((o) => returnPieces(o.id)));
}
