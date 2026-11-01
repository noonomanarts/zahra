import { getAdmin } from "@/lib/auth";
import { PERIODS, financeReport, periodRange, type Period } from "@/lib/finance";

const csv = (rows: (string | number)[][]) =>
  rows.map((r) => r.map((v) => (typeof v === "number" ? v.toFixed(3) : `"${String(v).replace(/"/g, '""')}"`)).join(",")).join("\r\n");

/** CSV of the selected period: summary, monthly figures and every cost/expense entry (amounts in OMR). */
export async function GET(request: Request) {
  if (!(await getAdmin())) return new Response("Forbidden", { status: 403 });
  const q = new URL(request.url).searchParams;
  const period = (PERIODS as readonly string[]).includes(q.get("p") ?? "") ? (q.get("p") as Period) : "month";
  const r = await financeReport(periodRange(period, q.get("from") ?? undefined, q.get("to") ?? undefined));
  const t = r.totals;
  const body = csv([
    ["Zahra's Design Studio – finance report (OMR)", `${r.range.from} to ${r.range.to}`],
    [],
    ["Sales revenue", t.revenue],
    ["  Product sales", t.productSales],
    ["  Shipping charged", t.shipping],
    ["Costs", t.costs],
    ["  Product costs (unit costs)", t.cogs],
    ["  Recorded costs", t.purchases],
    ["Expenses", t.expenses],
    ["Net profit", t.profit],
    [],
    ["Month", "Revenue", "Costs", "Expenses", "Net profit"],
    ...r.monthly.map((m) => [m.month, m.revenue, m.costs, m.expenses, m.profit]),
    [],
    ["Date", "Type", "Category", "Description", "Amount"],
    ...r.entries.map((e) => [e.date, e.kind, e.category, e.description, e.amount]),
  ]);
  return new Response("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zahra-finance-${r.range.from}-${r.range.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
