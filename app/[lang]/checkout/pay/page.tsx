import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { amwalCheckout } from "@/lib/amwalpay";
import { isLocale } from "@/lib/i18n/config";
import AmwalCheckout from "./AmwalCheckout";

export const metadata: Metadata = { robots: { index: false } };

export default async function PayPage({ params, searchParams }: PageProps<"/[lang]/checkout/pay">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { ref } = await searchParams;
  const order = typeof ref === "string" ? await db.query.orders.findFirst({ where: and(eq(schema.orders.paymentReference, ref), eq(schema.orders.paymentGateway, "amwalpay")) }) : undefined;
  if (!order?.paymentReference) notFound();
  // already settled: a reload or the back button must not offer to pay twice
  if (order.status !== "pending" && order.status !== "failed") redirect(`/${lang}/checkout/result?ref=${order.number}`);
  const { script, payload } = await amwalCheckout({ paymentReference: order.paymentReference, total: order.total }, lang);
  return <AmwalCheckout script={script} payload={payload} resultUrl={`/${lang}/checkout/result`} />;
}
