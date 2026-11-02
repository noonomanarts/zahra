import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
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

// ---------- admin ----------

/** Paid order lines of the given workshops, with the order each belongs to. */
function paidSeats(productIds: number[]) {
  return db
    .select({
      productId: schema.orderItems.productId,
      quantity: schema.orderItems.quantity,
      unitPrice: schema.orderItems.unitPrice,
      orderId: schema.orders.id,
      number: schema.orders.number,
      customerId: schema.orders.customerId,
      name: schema.orders.customerName,
      email: schema.orders.email,
      paidAt: schema.orders.paidAt,
      createdAt: schema.orders.createdAt,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .where(and(inArray(schema.orderItems.productId, productIds), inArray(schema.orders.status, [...PAID_STATUSES])));
}

/** Every workshop with its figures for the admin overview. */
export async function adminWorkshops() {
  const products = await db.select().from(schema.products).where(eq(schema.products.kind, "workshop")).orderBy(desc(schema.products.createdAt));
  const ids = products.map((p) => p.id);
  const [seats, grants] = ids.length
    ? await Promise.all([paidSeats(ids), db.select().from(schema.workshopGrants).where(inArray(schema.workshopGrants.productId, ids))])
    : [[], []];
  // a guest order counts as linked once the account with the same email has access
  const guestEmails = [...new Set(seats.filter((s) => !s.customerId).map((s) => s.email.trim().toLowerCase()))];
  const accounts = guestEmails.length
    ? await db.select({ id: schema.customers.id, email: schema.customers.email }).from(schema.customers).where(inArray(schema.customers.email, guestEmails))
    : [];
  const accountByEmail = new Map(accounts.map((a) => [a.email, a.id]));

  const everyone = new Set<number>();
  const list = products.map((p) => {
    const sold = seats.filter((s) => s.productId === p.id);
    const granted = grants.filter((g) => g.productId === p.id);
    const students = new Set([...sold.flatMap((s) => (s.customerId ? [s.customerId] : [])), ...granted.map((g) => g.customerId)]);
    students.forEach((id) => everyone.add(id));
    const dates = [...sold.map((s) => s.paidAt ?? s.createdAt), ...granted.map((g) => g.createdAt)];
    return {
      ...p,
      students: students.size,
      revenue: sold.reduce((sum, s) => sum + s.unitPrice * s.quantity, 0),
      unlinked: new Set(
        sold
          .filter((s) => {
            if (s.customerId) return false;
            const account = accountByEmail.get(s.email.trim().toLowerCase());
            return !(account && students.has(account));
          })
          .map((s) => s.orderId),
      ).size,
      lastJoined: dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null,
    };
  });
  return {
    list,
    totals: {
      workshops: list.length,
      published: list.filter((w) => w.published).length,
      students: everyone.size,
      revenue: list.reduce((sum, w) => sum + w.revenue, 0),
      lessons: list.reduce((sum, w) => sum + w.workshopVideos.length, 0),
      files: list.reduce((sum, w) => sum + w.workshopFiles.length, 0),
    },
  };
}

export type WorkshopStudent = {
  customerId: number;
  name: string;
  email: string;
  since: Date;
  orders: { id: number; number: string }[];
  manual: boolean;
};

/** Everyone who can open one workshop and how, plus paid guest orders that are not linked to an account yet. */
export async function workshopRoster(productId: number) {
  const [seats, grants] = await Promise.all([
    paidSeats([productId]),
    db
      .select({ customerId: schema.customers.id, name: schema.customers.name, email: schema.customers.email, since: schema.workshopGrants.createdAt })
      .from(schema.workshopGrants)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.workshopGrants.customerId))
      .where(eq(schema.workshopGrants.productId, productId)),
  ]);
  const linkedIds = [...new Set(seats.flatMap((s) => (s.customerId ? [s.customerId] : [])))];
  const accounts = linkedIds.length
    ? await db.select({ id: schema.customers.id, name: schema.customers.name, email: schema.customers.email }).from(schema.customers).where(inArray(schema.customers.id, linkedIds))
    : [];
  const account = new Map(accounts.map((a) => [a.id, a]));

  const students = new Map<number, WorkshopStudent>();
  const add = (customerId: number, name: string, email: string, since: Date) => {
    const known = students.get(customerId);
    if (known) {
      if (since < known.since) known.since = since;
      return known;
    }
    const entry: WorkshopStudent = { customerId, name, email, since, orders: [], manual: false };
    students.set(customerId, entry);
    return entry;
  };
  for (const s of seats) {
    const a = s.customerId ? account.get(s.customerId) : undefined;
    if (!a) continue;
    const entry = add(a.id, a.name, a.email, s.paidAt ?? s.createdAt);
    if (!entry.orders.some((o) => o.id === s.orderId)) entry.orders.push({ id: s.orderId, number: s.number });
  }
  for (const g of grants) add(g.customerId, g.name, g.email, g.since).manual = true;

  // guest checkouts: offer to link them when an account with the same email exists
  const guests = [...new Map(seats.filter((s) => !s.customerId).map((s) => [s.orderId, s])).values()];
  const emails = [...new Set(guests.map((g) => g.email.trim().toLowerCase()))];
  const matches = emails.length
    ? await db.select({ id: schema.customers.id, email: schema.customers.email }).from(schema.customers).where(inArray(schema.customers.email, emails))
    : [];
  const byEmail = new Map(matches.map((m) => [m.email, m.id]));
  const unlinked = guests
    .map((g) => {
      const customerId = byEmail.get(g.email.trim().toLowerCase()) ?? null;
      return { orderId: g.orderId, number: g.number, name: g.name, email: g.email, date: g.paidAt ?? g.createdAt, customerId };
    })
    // a guest whose account already has access needs nothing more
    .filter((g) => !(g.customerId && students.has(g.customerId)));

  return {
    students: [...students.values()].sort((a, b) => b.since.getTime() - a.since.getTime()),
    unlinked,
    revenue: seats.reduce((sum, s) => sum + s.unitPrice * s.quantity, 0),
  };
}

/** YouTube video id from a watch, share, shorts, live or embed link (unlisted videos work too). */
export function youtubeId(url: string) {
  return url.match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/|live\/)([\w-]{11})/)?.[1] ?? null;
}
