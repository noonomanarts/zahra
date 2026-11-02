import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ORDER_STATUSES, type OrderStatus } from "@/db/schema";
import { audit } from "@/lib/audit";
import { adminCan, getAdmin } from "@/lib/auth";
import { csvCell as cell, csvResponse } from "@/lib/csv";
import { likeTerm } from "@/components/admin/people";

/** The orders on screen (same status and search), amounts in OMR. */
export async function GET(request: Request) {
  if (!(await adminCan("orders.view"))) return new Response("Forbidden", { status: 403 });
  const params = new URL(request.url).searchParams;
  const status = params.get("status") as OrderStatus;
  const term = (params.get("q") ?? "").trim().slice(0, 100);
  const o = schema.orders;
  const rows = await db.select().from(o).where(and(
    ORDER_STATUSES.includes(status) ? eq(o.status, status) : undefined,
    term ? sql`(${o.number} LIKE ${likeTerm(term)} ESCAPE '\\' OR ${o.customerName} LIKE ${likeTerm(term)} ESCAPE '\\' OR ${o.email} LIKE ${likeTerm(term)} ESCAPE '\\' OR ${o.phone} LIKE ${likeTerm(term)} ESCAPE '\\')` : undefined,
  )).orderBy(desc(o.createdAt));
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  const money = (v: number) => v.toFixed(3);
  const body = [
    ["Order", "Date", "Status", "Customer", "Email", "Phone", "Country", "City", "Address", "Notes", "Paid on", "Coupon", "Subtotal (OMR)", "Discount (OMR)", "Shipping (OMR)", "Total (OMR)"].map(cell).join(","),
    ...rows.map((r) => [
      ...[r.number, day(r.createdAt), r.status, r.customerName, r.email, r.phone, r.country ?? "", r.city ?? "", r.address ?? "", r.notes ?? "", day(r.paidAt), r.couponCode ?? ""].map(cell),
      money(r.subtotal), money(r.discount), money(r.shipping), money(r.total),
    ].join(",")),
  ].join("\r\n");
  await audit(await getAdmin(), "orders.exported", { type: "order", label: `${rows.length}` });
  return csvResponse(body, "orders.csv");
}
