import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { pick, type Locale } from "./i18n/config";

/** Order statuses that mean the customer has paid. */
export const PAID_STATUSES = ["paid", "processing", "shipped", "completed"] as const;

type Access = { productId: number; since: Date };

/** Workshops a customer can open: bought in a paid order while signed in, or granted by the studio. */
async function accessList(customerId: number): Promise<Access[]> {
  const [bought, granted] = await Promise.all([
    db
      .select({ productId: schema.orderItems.productId, since: schema.orders.createdAt })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .where(and(eq(schema.orders.customerId, customerId), inArray(schema.orders.status, [...PAID_STATUSES]))),
    db
      .select({ productId: schema.workshopGrants.productId, since: schema.workshopGrants.createdAt })
      .from(schema.workshopGrants)
      .where(eq(schema.workshopGrants.customerId, customerId)),
  ]);
  const first = new Map<number, Date>();
  for (const row of [...bought, ...granted]) {
    if (row.productId === null) continue;
    const known = first.get(row.productId);
    if (!known || row.since < known) first.set(row.productId, row.since);
  }
  return [...first].map(([productId, since]) => ({ productId, since }));
}

export async function customerWorkshops(customerId: number, lang: Locale) {
  const access = await accessList(customerId);
  if (!access.length) return [];
  const rows = await db
    .select()
    .from(schema.products)
    .where(and(inArray(schema.products.id, access.map((a) => a.productId)), eq(schema.products.kind, "workshop")));
  const since = new Map(access.map((a) => [a.productId, a.since]));
  return rows
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: pick({ en: p.name, ar: p.nameAr }, lang),
      description: pick({ en: p.description, ar: p.descriptionAr }, lang),
      image: p.images[0] ?? null,
      videos: p.workshopVideos,
      files: p.workshopFiles,
      since: since.get(p.id)!,
    }))
    .sort((a, b) => b.since.getTime() - a.since.getTime());
}

export async function customerWorkshop(customerId: number, slug: string, lang: Locale) {
  return (await customerWorkshops(customerId, lang)).find((w) => w.slug === slug) ?? null;
}

export async function ownsWorkshop(customerId: number, productId: number) {
  return (await accessList(customerId)).some((a) => a.productId === productId);
}

/** Admin: everyone who can open a workshop, and how. */
export async function workshopParticipants(productId: number) {
  const [bought, granted] = await Promise.all([
    db
      .select({ id: schema.customers.id, name: schema.customers.name, email: schema.customers.email, order: schema.orders.number, orderId: schema.orders.id })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .innerJoin(schema.customers, eq(schema.customers.id, schema.orders.customerId))
      .where(and(eq(schema.orderItems.productId, productId), inArray(schema.orders.status, [...PAID_STATUSES]))),
    db
      .select({ id: schema.customers.id, name: schema.customers.name, email: schema.customers.email })
      .from(schema.workshopGrants)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.workshopGrants.customerId))
      .where(eq(schema.workshopGrants.productId, productId)),
  ]);
  return { bought, granted };
}

/** YouTube video id from a watch, share, shorts, live or embed link (unlisted videos work too). */
export function youtubeId(url: string) {
  return url.match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/|live\/)([\w-]{11})/)?.[1] ?? null;
}
