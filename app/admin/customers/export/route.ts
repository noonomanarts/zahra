import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { adminCan, getAdmin } from "@/lib/auth";
import { csvCell as cell, csvResponse } from "@/lib/csv";
import { customerStats } from "../stats";

/** Personal data of every customer, so it takes manage access and leaves a trace in the activity log. */
export async function GET() {
  if (!(await adminCan("customers.manage"))) return new Response("Forbidden", { status: 403 });
  const c = schema.customers;
  const stats = customerStats();
  const rows = await db
    .select({ name: c.name, email: c.email, createdAt: c.createdAt, lastLoginAt: c.lastLoginAt, disabledAt: c.disabledAt, orders: stats.orders, spent: stats.spent })
    .from(c)
    .leftJoin(stats, eq(stats.customerId, c.id))
    .orderBy(desc(c.createdAt));
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  const body = [
    ["Name", "Email", "Joined", "Last sign-in", "Status", "Orders", "Spent (OMR)"].map(cell).join(","),
    ...rows.map((r) => [cell(r.name), cell(r.email), cell(day(r.createdAt)), cell(day(r.lastLoginAt)), cell(r.disabledAt ? "suspended" : "active"), r.orders ?? 0, Number(r.spent ?? 0).toFixed(3)].join(",")),
  ].join("\r\n");
  await audit(await getAdmin(), "customers.exported");
  return csvResponse(body, "customers.csv");
}
