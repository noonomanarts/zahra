"use server";

import { headers } from "next/headers";
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
    const { redirectTo } = await placeOrder(
      { ...values, name: values.name, email: values.email, phone: values.phone, items },
      { appUrl, lang, displayCurrency: String(formData.get("currency") ?? "") },
    );
    return { redirectTo };
  } catch (e) {
    if (e instanceof CheckoutError) return { error: t.errors[e.code], values };
    console.error(e);
    return { error: t.errors.payment, values };
  }
}
