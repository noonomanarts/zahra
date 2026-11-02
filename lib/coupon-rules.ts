export type CouponRule = { type: "percent" | "fixed"; value: number; minSubtotal: number | null; startsOn: string | null; endsOn: string | null; active: boolean };
export type CouponProblem = "invalid" | "expired" | "minimum" | "limit";

const round = (n: number) => Math.round(n * 1000) / 1000;

export const normalizeCode = (code: string) => code.trim().toUpperCase();

/** Dates are Muscat days (YYYY-MM-DD); the end day is the last valid one. */
export function couponProblem(c: CouponRule, subtotal: number, today: string): CouponProblem | null {
  if (!c.active) return "invalid";
  if ((c.startsOn && today < c.startsOn) || (c.endsOn && today > c.endsOn)) return "expired";
  if (c.minSubtotal !== null && subtotal < c.minSubtotal) return "minimum";
  return null;
}

/** Off the products only, never the shipping, and never more than they cost. */
export function couponDiscount(c: Pick<CouponRule, "type" | "value">, subtotal: number) {
  const raw = c.type === "percent" ? (subtotal * Math.min(c.value, 100)) / 100 : c.value;
  return round(Math.min(Math.max(raw, 0), subtotal));
}
