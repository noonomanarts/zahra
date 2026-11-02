import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { couponDiscount, couponProblem, normalizeCode, type CouponProblem } from "./coupon-rules";
import { muscatDay } from "./finance";

export type { CouponProblem };

const o = schema.orders;
/** Paid orders count, and so do unpaid ones still within the time to pay; an abandoned payment gives its use back. */
export const countsAsUse = () => sql`(${o.status} IN ('paid','processing','shipped','completed') OR (${o.status} = 'pending' AND (${o.paymentReference} IS NULL OR ${o.createdAt} > unixepoch() - 7200)))`;

type CouponCheck = { problem: CouponProblem } | { coupon: typeof schema.coupons.$inferSelect; discount: number };

export async function checkCoupon(reader: Pick<typeof db, "select">, code: string, subtotal: number, email: string): Promise<CouponCheck> {
  const [coupon] = await reader.select().from(schema.coupons).where(eq(schema.coupons.code, normalizeCode(code))).limit(1);
  if (!coupon) return { problem: "invalid" };
  const problem = couponProblem(coupon, subtotal, muscatDay(new Date()));
  if (problem) return { problem };
  if (coupon.maxUses !== null) {
    const [used] = await reader.select({ n: count() }).from(o).where(and(eq(o.couponCode, coupon.code), countsAsUse()));
    if (used.n >= coupon.maxUses) return { problem: "limit" };
  }
  const buyer = email.trim().toLowerCase();
  if (coupon.oncePerCustomer && buyer) {
    const [used] = await reader.select({ n: count() }).from(o).where(and(eq(o.couponCode, coupon.code), sql`lower(${o.email}) = ${buyer}`, countsAsUse()));
    if (used.n > 0) return { problem: "limit" };
  }
  return { coupon, discount: couponDiscount(coupon, subtotal) };
}
