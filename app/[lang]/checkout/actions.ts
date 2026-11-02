"use server";

import { headers } from "next/headers";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";
import { checkCoupon, type CouponProblem } from "@/lib/coupons";
import { consumeCustomerAuthAttempt, getCustomer } from "@/lib/customer-auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { CheckoutError, placeOrder } from "@/lib/orders";

export type CheckoutState = { error?: string; redirectTo?: string; values?: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function checkout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const langValue = String(formData.get("lang"));
  const lang = isLocale(langValue) ? langValue : "en";
  const t = getDictionary(lang);
  const values = Object.fromEntries(
    ["name", "email", "phone", "country", "city", "address", "notes"].map((k) => [k, String(formData.get(k) ?? "").trim()]),
  );
  if (!values.name || !values.phone || !EMAIL.test(values.email)) return { error: t.errors.contact, values };

  let items: { slug: string; quantity: number }[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: t.errors.cartRead, values };
  }

  const h = await headers();
  const appUrl = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  try {
    const customer = await getCustomer();
    const { redirectTo } = await placeOrder(
      { ...values, name: values.name, email: values.email, phone: values.phone, items, coupon: String(formData.get("coupon") ?? "").trim() || undefined },
      { appUrl, lang, displayCurrency: String(formData.get("currency") ?? ""), customerId: customer?.id ?? null },
    );
    return { redirectTo };
  } catch (e) {
    if (e instanceof CheckoutError) return { error: t.errors[e.code], values };
    console.error(e);
    return { error: t.errors.payment, values };
  }
}

export type CouponPreview = { code: string; discount: number } | { problem: CouponProblem | "rateLimited" };

/** Shows the discount before paying. Prices come from the database; placing the order checks everything again. */
export async function previewCoupon(code: string, items: { slug: string; quantity: number }[], email: string): Promise<CouponPreview> {
  if (!(await consumeCustomerAuthAttempt("", "coupon"))) return { problem: "rateLimited" };
  const rows = await db.select({ slug: schema.products.slug, price: schema.products.price, digital: schema.products.digital, kind: schema.products.kind }).from(schema.products).where(inArray(schema.products.slug, items.map((i) => String(i.slug)).slice(0, 100)));
  const subtotal = rows.reduce((sum, p) => {
    const quantity = Math.min(Math.max(Math.floor(Number(items.find((i) => i.slug === p.slug)?.quantity)) || 0, 0), 99);
    return sum + p.price * (p.digital || p.kind === "workshop" ? Math.min(quantity, 1) : quantity);
  }, 0);
  const result = await checkCoupon(db, code, subtotal, email);
  return "problem" in result ? { problem: result.problem } : { code: result.coupon.code, discount: result.discount };
}
