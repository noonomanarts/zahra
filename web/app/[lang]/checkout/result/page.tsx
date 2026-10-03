import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import Button from "@/components/Button";
import { applyPaymobTransaction } from "@/lib/orders";
import { verifyResponseCallback } from "@/lib/paymob";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref } from "@/lib/i18n/config";
import ClearCart from "./ClearCart";

export const metadata: Metadata = { robots: { index: false } };

/**
 * Landing page after checkout. Paymob redirects here with signed query params (?hmac=…);
 * without online payment the order number comes in ?ref=.
 */
export default async function CheckoutResultPage({ params, searchParams }: PageProps<"/[lang]/checkout/result">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang).result;
  const query = Object.fromEntries(
    Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>;

  let status: "paid" | "failed" | "received" | "invalid" = "invalid";
  let number: string | null = null;

  if (query.hmac) {
    const tx = verifyResponseCallback(query);
    const order = tx && (await applyPaymobTransaction(tx));
    if (order) {
      number = order.number;
      status = order.status === "paid" ? "paid" : "failed";
    }
  } else if (query.ref) {
    const order = await db.query.orders.findFirst({ where: eq(schema.orders.number, query.ref) });
    if (order) {
      number = order.number;
      status = order.status === "paid" ? "paid" : "received";
    }
  }

  const content = {
    paid: [t.paidTitle, t.paidText],
    received: [t.receivedTitle, t.receivedText],
    failed: [t.failedTitle, t.failedText],
    invalid: [t.invalidTitle, t.invalidText],
  }[status];
  const ok = status === "paid" || status === "received";

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      {ok && <ClearCart />}
      <p className="font-script text-6xl text-brand">{ok ? t.thankYou : t.oops}</p>
      <h1 className="mt-4 text-3xl font-bold">{content[0]}</h1>
      {number && <p className="mt-2 text-muted">{t.order(number)}</p>}
      <p className="mt-4">{content[1]}</p>
      <div className="mt-8">
        {status === "failed" ? (
          <Button href={localizeHref(lang, "/checkout")}>{t.tryAgain}</Button>
        ) : (
          <Button href={localizeHref(lang, "/shop")}>{getDictionary(lang).checkout.continueShopping}</Button>
        )}
      </div>
    </div>
  );
}
