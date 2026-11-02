import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { getAdmin } from "./auth";
import { getCustomer } from "./customer-auth";
import { can } from "./permissions";
import { sameSignature, signWithSiteKey } from "./secrets";
import { absoluteUrl } from "./seo";
import { PAID_STATUSES } from "./workshops";

/** A link from an email keeps working this long after payment; the buyer's account has no limit. */
export const DOWNLOAD_LINK_DAYS = 30;

type Order = typeof schema.orders.$inferSelect;

/** The key in a download link. Derived, not stored: nothing to leak from the database and no way to guess it from the order number. */
export const downloadKey = (orderId: number) => signWithSiteKey(`download:${orderId}`);
export const validDownloadKey = (orderId: number, key: unknown) => typeof key === "string" && sameSignature(downloadKey(orderId), key);
export const downloadUrl = (order: { id: number; locale: string }) => absoluteUrl(`/${order.locale === "ar" ? "ar" : "en"}/downloads/${order.id}?key=${downloadKey(order.id)}`);

export const isPaid = (order: Pick<Order, "status">) => (PAID_STATUSES as readonly string[]).includes(order.status);

/** The files this order delivers, and the digital items that have none yet and go out by hand. */
export async function orderDeliverables(orderId: number) {
  const items = await db.select().from(schema.orderItems).where(and(eq(schema.orderItems.orderId, orderId), eq(schema.orderItems.digital, true)));
  const ids = items.flatMap((i) => (i.productId ? [i.productId] : []));
  const products = ids.length ? await db.select().from(schema.products).where(and(inArray(schema.products.id, ids), eq(schema.products.kind, "product"))) : [];
  const workshops = ids.length ? await db.select({ id: schema.products.id }).from(schema.products).where(and(inArray(schema.products.id, ids), eq(schema.products.kind, "workshop"))) : [];
  const isWorkshop = new Set(workshops.map((w) => w.id));
  const byId = new Map(products.map((p) => [p.id, p]));
  const files = products.flatMap((p) => p.digitalFiles.map((f) => ({ productId: p.id, productName: p.name, productNameAr: p.nameAr, id: f.id, name: f.name, size: f.size, file: f.file })));
  const manual = items.filter((i) => !(i.productId && isWorkshop.has(i.productId)) && !byId.get(i.productId ?? -1)?.digitalFiles.length).map((i) => i.name);
  return { files, manual };
}

export type DownloadAccess = "allowed" | "unpaid" | "expired" | "denied";

/**
 * Who may have an order's files: its signed-in buyer, staff who can see orders, or anyone with the link while it is valid.
 * Payment is checked every time, so cancelling an order ends its downloads.
 */
export async function downloadAccess(order: Order, key: unknown): Promise<DownloadAccess> {
  const admin = await getAdmin();
  if (admin && !admin.mustChangePassword && can(admin.permissions, "orders.view")) return "allowed";
  const customer = await getCustomer();
  const owner = Boolean(customer && order.customerId === customer.id);
  const linked = validDownloadKey(order.id, key);
  if (!owner && !linked) return "denied";
  if (!isPaid(order)) return "unpaid";
  if (owner) return "allowed";
  const paidAt = order.paidAt ?? order.createdAt;
  return Date.now() - paidAt.getTime() > DOWNLOAD_LINK_DAYS * 864e5 ? "expired" : "allowed";
}
