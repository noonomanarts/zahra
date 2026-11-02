import "server-only";
import { and, avg, count, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { PAID_STATUSES, ownsWorkshop } from "./workshops";

/** Only people who really bought the product, from their own account. */
export async function canReview(customerId: number, productId: number, kind: "product" | "workshop") {
  if (kind === "workshop") return ownsWorkshop(customerId, productId);
  const [bought] = await db
    .select({ n: count() })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .where(and(eq(schema.orderItems.productId, productId), eq(schema.orders.customerId, customerId), inArray(schema.orders.status, [...PAID_STATUSES])));
  return bought.n > 0;
}

/** Approved reviews with the buyer's first name only: their full name and email stay private. */
export async function productReviews(productId: number) {
  const r = schema.productReviews;
  const where = and(eq(r.productId, productId), eq(r.status, "approved"));
  const [rows, [summary]] = await Promise.all([
    db.select({ id: r.id, rating: r.rating, body: r.body, createdAt: r.createdAt, name: schema.customers.name })
      .from(r)
      .innerJoin(schema.customers, eq(schema.customers.id, r.customerId))
      .where(where)
      .orderBy(desc(r.createdAt))
      .limit(50),
    db.select({ n: count(), average: avg(r.rating) }).from(r).where(where),
  ]);
  return {
    reviews: rows.map(({ name, ...row }) => ({ ...row, author: name.trim().split(/\s+/)[0] })),
    count: summary.n,
    average: summary.n ? Math.round(Number(summary.average) * 10) / 10 : 0,
  };
}
