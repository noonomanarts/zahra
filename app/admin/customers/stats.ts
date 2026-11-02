import "server-only";
import { count, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { PAID_STATUSES } from "@/lib/workshops";

/** Per-customer order totals, to join onto the customers table. Only orders placed while signed in count. */
export const customerStats = () => {
  const o = schema.orders;
  const paid = sql.join(PAID_STATUSES.map((s) => sql`${s}`), sql`, `);
  return db
    .select({
      customerId: o.customerId,
      orders: count().as("order_count"),
      spent: sql<number>`coalesce(sum(case when ${o.status} in (${paid}) then ${o.total} end), 0)`.as("spent"),
      paidOrders: sql<number>`sum(case when ${o.status} in (${paid}) then 1 else 0 end)`.as("paid_orders"),
      lastOrder: sql<number>`max(${o.createdAt})`.as("last_order"),
    })
    .from(o)
    .where(isNotNull(o.customerId))
    .groupBy(o.customerId)
    .as("customer_stats");
};
