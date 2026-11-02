import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { downloadAccess } from "@/lib/downloads";
import { attachment, readPrivateFile } from "@/lib/uploads";

/** A file of a digital product, for someone allowed to have this order's files. */
export async function GET(request: Request, { params }: RouteContext<"/api/downloads/[orderId]/[productId]/[fileId]">) {
  const { orderId, productId, fileId } = await params;
  const oid = Number(orderId);
  const pid = Number(productId);
  const order = Number.isInteger(oid) ? await db.query.orders.findFirst({ where: eq(schema.orders.id, oid) }) : undefined;
  if (!order) return new Response("Not found", { status: 404 });
  if ((await downloadAccess(order, new URL(request.url).searchParams.get("key"))) !== "allowed") return new Response("Forbidden", { status: 403 });

  // the product must really be in this order: a valid link for one order opens nothing else
  const [item] = Number.isInteger(pid) ? await db.select({ id: schema.orderItems.id }).from(schema.orderItems).where(and(eq(schema.orderItems.orderId, oid), eq(schema.orderItems.productId, pid), eq(schema.orderItems.digital, true))).limit(1) : [];
  const product = item ? await db.query.products.findFirst({ where: eq(schema.products.id, pid), columns: { digitalFiles: true } }) : undefined;
  const entry = product?.digitalFiles.find((f) => f.id === fileId);
  const file = entry ? await readPrivateFile(entry.file) : null;
  if (!entry || !file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": attachment(entry.name),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
