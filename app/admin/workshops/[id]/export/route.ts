import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { adminCan } from "@/lib/auth";
import { muscatDay } from "@/lib/finance";
import { workshopRoster } from "@/lib/workshops";

// names come from customers: a leading = + - @ would run as a spreadsheet formula
const cell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
const csv = (rows: string[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n");

/** CSV of everyone who can open one workshop. */
export async function GET(_request: Request, { params }: RouteContext<"/admin/workshops/[id]/export">) {
  if (!(await adminCan("workshops.view"))) return new Response("Forbidden", { status: 403 });
  const id = Number((await params).id);
  const product = Number.isInteger(id) ? await db.query.products.findFirst({ where: eq(schema.products.id, id) }) : undefined;
  if (!product || product.kind !== "workshop") return new Response("Not found", { status: 404 });

  const { students } = await workshopRoster(product.id);
  const body = csv([
    ["Name", "Email", "Access", "Since"],
    ...students.map((s) => [
      s.name,
      s.email,
      [...s.orders.map((o) => `Order ${o.number}`), ...(s.manual ? ["Given by hand"] : [])].join("; "),
      muscatDay(s.since),
    ]),
  ]);
  return new Response("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="workshop-${product.slug}-students.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
