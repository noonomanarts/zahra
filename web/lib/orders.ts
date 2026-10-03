import "server-only";
import { eq, inArray, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSite } from "./data";
import { getCurrencySettings } from "./currency-server";
import { isCurrency, type CurrencyCode } from "./currency";
import type { Locale } from "./i18n/config";
import { createIntention, paymobEnabled, toMinorUnits, type PaymobTransaction } from "./paymob";

export type CheckoutInput = {
  items: { slug: string; quantity: number }[];
  name: string;
  email: string;
  phone: string;
  country?: string;
  city?: string;
  address?: string;
  notes?: string;
};

type OrderContext = { appUrl: string; lang: Locale; displayCurrency?: string };

/**
 * Creates an order from the cart (prices are taken from the database, never from the browser)
 * and returns where to send the customer next: Paymob checkout, or the confirmation page when
 * online payment is not configured.
 */
export async function placeOrder(input: CheckoutInput, { appUrl, lang, displayCurrency }: OrderContext) {
  const quantities = new Map<string, number>();
  for (const i of input.items) {
    const q = Math.floor(Number(i.quantity));
    if (q > 0) quantities.set(i.slug, Math.min(q, 99));
  }
  if (!quantities.size) throw new CheckoutError("empty");

  const rows = await db.select().from(schema.products).where(inArray(schema.products.slug, [...quantities.keys()]));
  const available = rows.filter((p) => p.published && p.inStock);
  if (available.length !== quantities.size) throw new CheckoutError("unavailable");

  const site = await getSite();
  const lines = available.map((p) => ({
    productId: p.id,
    slug: p.slug,
    name: p.name,
    unitPrice: p.price,
    quantity: p.digital ? 1 : quantities.get(p.slug)!,
    digital: p.digital,
  }));
  const needsShipping = lines.some((l) => !l.digital);
  if (needsShipping && !(input.address && input.city && input.country)) {
    throw new CheckoutError("address");
  }

  const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
  const shipping = needsShipping ? site.shippingFee : 0;
  const total = Math.round((subtotal + shipping) * 1000) / 1000;
  const currency = available[0].currency;
  // remember what the customer saw; the charge itself is always in the store currency (OMR)
  const shown: CurrencyCode = isCurrency(displayCurrency) ? displayCurrency : "OMR";
  const displayRate = shown === "OMR" ? 1 : (await getCurrencySettings()).rates[shown];

  const order = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.orders)
      .values({
        number: `tmp-${crypto.randomUUID()}`,
        customerName: input.name,
        email: input.email,
        phone: input.phone,
        country: input.country || null,
        city: input.city || null,
        address: input.address || null,
        notes: input.notes || null,
        currency,
        displayCurrency: shown,
        displayRate,
        locale: lang,
        subtotal,
        shipping,
        total,
      })
      .returning();
    const number = `ZDS-${1000 + created.id}`;
    await tx.update(schema.orders).set({ number }).where(eq(schema.orders.id, created.id));
    await tx.insert(schema.orderItems).values(lines.map((l) => ({ ...l, orderId: created.id })));
    return { ...created, number };
  });

  if (!paymobEnabled()) return { orderNumber: order.number, redirectTo: `/${lang}/checkout/result?ref=${order.number}` };

  // unique per payment attempt, so a failed payment can be retried with a new intention
  const reference = `${order.number}-${Date.now().toString(36)}`;
  const intention = await createIntention({
    reference,
    currency,
    total,
    items: [...lines, ...(shipping ? [{ name: "Shipping", unitPrice: shipping, quantity: 1 }] : [])],
    customer: input,
    returnUrl: `${appUrl}/${lang}/checkout/result`,
    appUrl,
  });
  await db
    .update(schema.orders)
    .set({ paymentReference: reference, paymobIntentionId: intention.intentionId, paymobOrderId: intention.paymobOrderId })
    .where(eq(schema.orders.id, order.id));
  return { orderNumber: order.number, redirectTo: intention.checkoutUrl };
}

/** `message` is a key of the "errors" dictionary section, translated for the customer. */
export class CheckoutError extends Error {
  constructor(public code: "empty" | "unavailable" | "address") {
    super(code);
  }
}

/** Applies a verified Paymob transaction to its order. Idempotent: a paid order is never downgraded. */
export async function applyPaymobTransaction(tx: PaymobTransaction) {
  const conditions = [eq(schema.orders.paymobOrderId, tx.paymobOrderId)];
  if (tx.reference) conditions.push(eq(schema.orders.paymentReference, tx.reference));
  const order = await db.query.orders.findFirst({ where: or(...conditions) });
  if (!order) return null;

  if (tx.success && !tx.pending) {
    if (tx.amountMinor !== toMinorUnits(order.total)) {
      console.error(`Paymob amount mismatch for ${order.number}: got ${tx.amountMinor}, expected ${toMinorUnits(order.total)}`);
      return order;
    }
    if (order.status === "pending" || order.status === "failed") {
      await db
        .update(schema.orders)
        .set({ status: "paid", paidAt: new Date(), paymobTransactionId: tx.transactionId, paymobOrderId: tx.paymobOrderId })
        .where(eq(schema.orders.id, order.id));
      return { ...order, status: "paid" as const };
    }
  } else if (!tx.pending && order.status === "pending") {
    await db
      .update(schema.orders)
      .set({ status: "failed", paymobTransactionId: tx.transactionId })
      .where(eq(schema.orders.id, order.id));
    return { ...order, status: "failed" as const };
  }
  return order;
}
