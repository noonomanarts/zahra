import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getAdmin } from "@/lib/auth";
import { getCustomer } from "@/lib/customer-auth";
import { attachment, readPrivateFile } from "@/lib/uploads";
import { ownsWorkshop } from "@/lib/workshops";

/** Workshop downloads: only for customers who bought the workshop (and for the admin). */
export async function GET(_request: Request, { params }: RouteContext<"/api/workshops/[productId]/files/[fileId]">) {
  const { productId, fileId } = await params;
  const id = Number(productId);
  const product = Number.isInteger(id) ? await db.query.products.findFirst({ where: eq(schema.products.id, id) }) : undefined;
  const entry = product?.kind === "workshop" ? product.workshopFiles.find((f) => f.id === fileId) : undefined;
  if (!product || !entry) return new Response("Not found", { status: 404 });

  const [admin, customer] = await Promise.all([getAdmin(), getCustomer()]);
  if (!admin && !(customer && (await ownsWorkshop(customer.id, product.id)))) {
    return new Response("Forbidden", { status: 403 });
  }

  const file = await readPrivateFile(entry.file);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": attachment(entry.name),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
