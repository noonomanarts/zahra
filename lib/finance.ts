import "server-only";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { PAID_STATUSES } from "./workshops";

export const FINANCE_CATEGORIES = ["materials", "fabric", "packaging", "printing", "shipping", "marketing", "fees", "software", "rent", "workshops", "other"] as const;
export const PERIODS = ["month", "lastMonth", "quarter", "year", "all", "custom"] as const;
export type Period = (typeof PERIODS)[number];

/** Calendar dates are Muscat dates (UTC+4, no daylight saving). */
const OFFSET = 4 * 3600_000;
export const muscatDay = (d: Date) => new Date(d.getTime() + OFFSET).toISOString().slice(0, 10);
const round = (n: number) => Math.round(n * 1000) / 1000;
const monthStart = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

export function periodRange(period: Period, from?: string, to?: string): { from: string; to: string } {
  const today = muscatDay(new Date());
  const [y, m] = today.split("-").map(Number);
  switch (period) {
    case "lastMonth":
      return { from: monthStart(y, m - 1), to: monthEnd(y, m - 1) };
    case "quarter":
      return { from: monthStart(y, m - 2), to: today };
    case "year":
      return { from: `${y}-01-01`, to: today };
    case "all":
      return { from: "2000-01-01", to: today };
    case "custom": {
      const valid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
      const a = valid(from) ? from! : monthStart(y, m);
      const b = valid(to) ? to! : today;
      return a <= b ? { from: a, to: b } : { from: b, to: a };
    }
    default:
      return { from: monthStart(y, m), to: today };
  }
}

type Totals = { revenue: number; productSales: number; shipping: number; cogs: number; purchases: number; expenses: number; orders: number };
const empty = (): Totals => ({ revenue: 0, productSales: 0, shipping: 0, cogs: 0, purchases: 0, expenses: 0, orders: 0 });
const profitOf = (t: Totals) => round(t.revenue - t.cogs - t.purchases - t.expenses);
const rounded = (t: Totals): Totals => ({ ...t, ...Object.fromEntries(Object.entries(t).filter(([k]) => k !== "orders").map(([k, v]) => [k, round(v)])) });

/**
 * Every figure of the finance page. Net profit = sales − (product costs + recorded costs) − expenses.
 * Sales are paid orders (including shipping charged), dated by payment. The catalogue is small, so this runs in memory.
 */
export async function financeReport(range: { from: string; to: string }) {
  const [orders, entries, products] = await Promise.all([
    db.select().from(schema.orders).where(inArray(schema.orders.status, [...PAID_STATUSES])),
    db.select().from(schema.financeEntries),
    db.select({ id: schema.products.id, unitCost: schema.products.unitCost }).from(schema.products),
  ]);
  const items = orders.length ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, orders.map((o) => o.id))) : [];
  const currentCost = new Map(products.map((p) => [p.id, p.unitCost]));
  // the cost saved with the order; orders placed before costs were recorded use the product's current unit cost
  const costOf = (i: (typeof items)[number]) => i.unitCost ?? (i.productId ? currentCost.get(i.productId) : null) ?? null;

  const paidShare = new Map(orders.map((o) => [o.id, o.subtotal > 0 ? (o.subtotal - o.discount) / o.subtotal : 1]));
  const dayOf = new Map(orders.map((o) => [o.id, muscatDay(o.paidAt ?? o.createdAt)]));
  const inRange = (day: string) => day >= range.from && day <= range.to;

  const [y, m] = muscatDay(new Date()).split("-").map(Number);
  const monthKeys = [...Array(12)].map((_, i) => monthStart(y, m - i).slice(0, 7));
  const months = new Map(monthKeys.map((k) => [k, empty()]));
  const buckets = (day: string) => [inRange(day) ? totals : null, months.get(day.slice(0, 7)) ?? null].filter((t): t is Totals => !!t);

  const totals = empty();
  for (const o of orders) {
    for (const t of buckets(dayOf.get(o.id)!)) {
      t.orders++;
      t.revenue += o.total;
      t.productSales += o.subtotal - o.discount;
      t.shipping += o.shipping;
    }
  }

  const missing = new Set<number | string>();
  const top = new Map<string, { name: string; productId: number | null; quantity: number; sales: number; cost: number }>();
  for (const i of items) {
    const day = dayOf.get(i.orderId)!;
    const cost = costOf(i);
    const lineCost = (cost ?? 0) * i.quantity;
    for (const t of buckets(day)) t.cogs += lineCost;
    if (!inRange(day)) continue;
    if (cost === null) missing.add(i.productId ?? i.name);
    const key = i.productId ? `p${i.productId}` : i.name;
    const row = top.get(key) ?? { name: i.name, productId: i.productId, quantity: 0, sales: 0, cost: 0 };
    row.quantity += i.quantity;
    // a coupon lowers every line of its order by the same share
    row.sales = round(row.sales + i.unitPrice * i.quantity * (paidShare.get(i.orderId) ?? 1));
    row.cost = round(row.cost + lineCost);
    top.set(key, row);
  }

  for (const e of entries) {
    for (const t of buckets(e.date)) t[e.kind === "cost" ? "purchases" : "expenses"] += e.amount;
  }

  const sum = rounded(totals);
  return {
    range,
    totals: { ...sum, costs: round(sum.cogs + sum.purchases), profit: profitOf(sum) },
    monthly: monthKeys.map((month) => {
      const t = rounded(months.get(month)!);
      return { month, ...t, costs: round(t.cogs + t.purchases), profit: profitOf(t) };
    }),
    missingCosts: missing.size,
    topProducts: [...top.values()].sort((a, b) => b.sales - a.sales).slice(0, 8),
    entries: entries.filter((e) => inRange(e.date)).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
  };
}
