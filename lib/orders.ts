import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gte, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { checkCoupon } from "./coupons";
import { getSite } from "./data";
import { downloadKey } from "./downloads";
import { effectiveInStock } from "./format";
import { releaseAbandonedOrders, syncStock } from "./stock";
import { getCurrencySettings } from "./currency-server";
import { isCurrency, type CurrencyCode } from "./currency";
import type { Locale } from "./i18n/config";
import { notifyAdmins } from "./admin-notifications";
import { stockNotice } from "./notification-kinds";
import { notifyOrder, notifyPaymentProblem } from "./notifications";
import { activeGateway } from "./payments";
import { createIntention, toMinorUnits, type PaymobTransaction } from "./paymob";

export type CheckoutInput = {
  items: { slug: string; quantity: number }[];
  name: string;
  email: string;
  phone: string;
  country?: string;
  city?: string;
  address?: string;
  notes?: string;
  coupon?: string;
};

type OrderContext = { appUrl: string; lang: Locale; displayCurrency?: string; customerId?: number | null };

/**
 * Creates an order from the cart (prices are taken from the database, never from the browser)
 * and returns where to send the customer next: Paymob checkout, or the confirmation page when
 * online payment is not configured.
 */
export async function placeOrder(input: CheckoutInput, { appUrl, lang, displayCurrency, customerId = null }: OrderContext) {
  const quantities = new Map<string, number>();
  for (const i of input.items) {
    const q = Math.floor(Number(i.quantity));
    if (q > 0) quantities.set(i.slug, Math.min(q, 99));
  }
  if (!quantities.size) throw new CheckoutError("empty");

  await releaseAbandonedOrders();
  const rows = await db.select().from(schema.products).where(inArray(schema.products.slug, [...quantities.keys()]));
  const available = rows.filter((p) => p.published && effectiveInStock(p));
  if (available.length !== quantities.size) throw new CheckoutError("unavailable");

  // workshops unlock in the buyer's account, so they can only be bought while signed in
  if (!customerId && available.some((p) => p.kind === "workshop")) throw new CheckoutError("loginRequired");

  const site = await getSite();
  const lines = available.map((p) => {
    const digital = p.digital || p.kind === "workshop";
    return {
      productId: p.id,
      slug: p.slug,
      name: p.name,
      unitPrice: p.price,
      unitCost: p.unitCost,
      quantity: digital ? 1 : quantities.get(p.slug)!,
      digital,
    };
  });
  const needsShipping = lines.some((l) => !l.digital);
  if (needsShipping && !(input.address && input.city && input.country)) {
    throw new CheckoutError("address");
  }

  const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
  const shipping = needsShipping ? site.shippingFee : 0;
  const currency = available[0].currency;
  // remember what the customer saw; the charge itself is always in the store currency (OMR)
  const shown: CurrencyCode = isCurrency(displayCurrency) ? displayCurrency : "OMR";
  const displayRate = shown === "OMR" ? 1 : (await getCurrencySettings()).rates[shown];

  const counted = lines.filter((l) => !l.digital && available.find((p) => p.id === l.productId)?.stock !== null);

  const stockNotices: { kind: "stock.low" | "stock.out"; id: number; name: string; left: number }[] = [];
  const order = await db.transaction(async (tx) => {
    // checked here, so two customers can't take the last use of a coupon or the last piece of a kit
    const applied = input.coupon ? await checkCoupon(tx, input.coupon, subtotal, input.email) : null;
    if (applied && "problem" in applied) throw new CheckoutError("coupon");
    const discount = applied?.discount ?? 0;
    const total = Math.round((subtotal + shipping - discount) * 1000) / 1000;
    for (const line of counted) {
      const [taken] = await tx
        .update(schema.products)
        .set({ stock: sql`${schema.products.stock} - ${line.quantity}` })
        .where(and(eq(schema.products.id, line.productId), isNotNull(schema.products.stock), gte(schema.products.stock, line.quantity)))
        .returning({ stock: schema.products.stock });
      if (!taken) throw new CheckoutError("outOfStock");
      const notice = stockNotice(taken.stock! + line.quantity, taken.stock!);
      if (notice) stockNotices.push({ kind: notice, id: line.productId, name: line.name, left: taken.stock! });
    }
    const free = total <= 0;
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
        customerId,
        subtotal,
        shipping,
        discount,
        couponCode: applied && "coupon" in applied ? applied.coupon.code : null,
        stockReserved: counted.length > 0,
        total,
        // nothing left to pay, so there is no payment to wait for
        ...(free ? { status: "paid" as const, paidAt: new Date() } : {}),
      })
      .returning();
    const number = `ZDS-${1000 + created.id}`;
    await tx.update(schema.orders).set({ number }).where(eq(schema.orders.id, created.id));
    await tx.insert(schema.orderItems).values(lines.map((l) => ({ ...l, orderId: created.id })));
    return { ...created, number };
  });

  const total = order.total;
  for (const n of stockNotices) await notifyAdmins(n.kind, { name: n.name, left: String(n.left) }, `/admin/products/${n.id}`);
  const gateway = total > 0 ? await activeGateway() : null;
  if (!gateway) {
    notifyOrder(order.id, total <= 0 ? "paid" : "received");
    // a free order has no gateway to vouch for it, so its result page gets the download key
    const key = total <= 0 ? `&key=${downloadKey(order.id)}` : "";
    return { orderNumber: order.number, redirectTo: `/${lang}/checkout/result?ref=${order.number}${key}` };
  }

  if (gateway === "amwalpay") {
    // the reference is also the address of the payment page, so it can't be guessed from the order number
    const reference = `${order.number}-${randomBytes(6).toString("hex")}`;
    await db.update(schema.orders).set({ paymentReference: reference, paymentGateway: "amwalpay" }).where(eq(schema.orders.id, order.id));
    return { orderNumber: order.number, redirectTo: `/${lang}/checkout/pay?ref=${reference}` };
  }


  // unique per payment attempt, so a failed payment can be retried with a new intention
  const reference = `${order.number}-${Date.now().toString(36)}`;
  const intention = await createIntention({
    reference,
    currency,
    total,
    // Paymob wants the items to add up to the amount and has no discount line, so a discounted order is one item
    items: order.discount > 0
      ? [{ name: `Order ${order.number}`, unitPrice: total, quantity: 1 }]
      : [...lines, ...(shipping ? [{ name: "Shipping", unitPrice: shipping, quantity: 1 }] : [])],
    customer: input,
    returnUrl: `${appUrl}/${lang}/checkout/result`,
    appUrl,
  });
  await db
    .update(schema.orders)
    .set({ paymentReference: reference, paymentGateway: "paymob", paymobIntentionId: intention.intentionId, paymobOrderId: intention.paymobOrderId })
    .where(eq(schema.orders.id, order.id));
  return { orderNumber: order.number, redirectTo: intention.checkoutUrl };
}

/** `message` is a key of the "errors" dictionary section, translated for the customer. */
export class CheckoutError extends Error {
  constructor(public code: "empty" | "unavailable" | "address" | "loginRequired" | "coupon" | "outOfStock") {
    super(code);
  }
}

type Order = typeof schema.orders.$inferSelect;

/** Applies a verified payment result to its order. Idempotent: a paid order is never downgraded. */
async function settle(order: Order, result: { success: boolean; pending: boolean; amountMinor: number; ids: Partial<Order> }) {
  if (result.success && !result.pending) {
    if (result.amountMinor !== toMinorUnits(order.total)) {
      console.error(`Payment amount mismatch for ${order.number}: got ${result.amountMinor}, expected ${toMinorUnits(order.total)}`);
      notifyPaymentProblem("payment.mismatch", order);
      return order;
    }
    if (order.status === "pending" || order.status === "failed") {
      await syncStock(order, "paid");
      // the browser's return and the gateway's notification can arrive together: only one of them moves the order
      const [moved] = await db
        .update(schema.orders)
        .set({ status: "paid", paidAt: new Date(), ...result.ids })
        .where(and(eq(schema.orders.id, order.id), inArray(schema.orders.status, ["pending", "failed"])))
        .returning({ id: schema.orders.id });
      if (moved) notifyOrder(order.id, "paid");
      return { ...order, status: "paid" as const };
    }
  } else if (!result.pending && order.status === "pending") {
    await syncStock(order, "failed");
    await db.update(schema.orders).set({ status: "failed", ...result.ids }).where(eq(schema.orders.id, order.id));
    notifyPaymentProblem("payment.failed", order);
    return { ...order, status: "failed" as const };
  }
  return order;
}

export async function applyPaymobTransaction(tx: PaymobTransaction) {
  const conditions = [eq(schema.orders.paymobOrderId, tx.paymobOrderId)];
  if (tx.reference) conditions.push(eq(schema.orders.paymentReference, tx.reference));
  const order = await db.query.orders.findFirst({ where: or(...conditions) });
  if (!order) return null;
  return settle(order, { ...tx, ids: tx.success && !tx.pending ? { paymobTransactionId: tx.transactionId, paymobOrderId: tx.paymobOrderId } : { paymobTransactionId: tx.transactionId } });
}

export async function applyAmwalTransaction(tx: { reference: string; transactionId: string; success: boolean; amountMinor: number }) {
  const order = await db.query.orders.findFirst({ where: and(eq(schema.orders.paymentReference, tx.reference), eq(schema.orders.paymentGateway, "amwalpay")) });
  if (!order) return null;
  return settle(order, { ...tx, pending: false, ids: { gatewayTransactionId: tx.transactionId } });
}
