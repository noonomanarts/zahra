import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ORDER_STATUSES } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatMoney, isCurrency } from "@/lib/currency";
import { getAdminT } from "@/lib/i18n/admin-server";
import { LOCALE_NAMES, isLocale } from "@/lib/i18n/config";
import { Badge, Card, PageTitle, btnCls, inputCls } from "@/components/admin/ui";
import { updateOrderStatus } from "../actions";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const { lang, t } = await getAdminT();
  const o = t.orders;
  const id = Number((await params).id);
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
  if (!order) notFound();
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id));
  const money = (v: number) => <bdi>{formatMoney(v, "OMR", lang)}</bdi>;
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" });
  const shown =
    order.displayCurrency && order.displayCurrency !== "OMR" && isCurrency(order.displayCurrency) && order.displayRate
      ? `${order.displayCurrency} · ≈ ${formatMoney(order.total * order.displayRate, order.displayCurrency, lang)}`
      : "OMR";

  const info = (label: string, value: React.ReactNode, ltr = false) =>
    value ? (
      <div className="flex justify-between gap-4 py-1.5">
        <dt className="text-zinc-500">{label}</dt>
        <dd className="text-end" dir={ltr ? "ltr" : undefined}>{value}</dd>
      </div>
    ) : null;

  return (
    <>
      <PageTitle title={o.orderNo(order.number)} back="/admin/orders" backLabel={t.common.back} actions={<Badge status={order.status} label={t.status[order.status]} />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title={o.items}>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100">
                {items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2.5">
                      {i.productId ? <Link href={`/admin/products/${i.productId}`} className="hover:underline">{i.name}</Link> : i.name}
                      {i.digital && <span className="ms-2 text-xs text-zinc-500">PDF</span>}
                    </td>
                    <td className="py-2.5 text-zinc-500">{money(i.unitPrice)} × {i.quantity}</td>
                    <td className="py-2.5 text-end">{money(i.unitPrice * i.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 border-t border-zinc-200 pt-3 text-sm">
              {info(o.subtotal, money(order.subtotal))}
              {info(o.shipping, money(order.shipping))}
              <div className="flex justify-between pt-2 font-semibold"><dt>{o.total}</dt><dd>{money(order.total)}</dd></div>
            </dl>
          </Card>

          <Card title={o.customer}>
            <dl className="text-sm">
              {info(o.name, order.customerName)}
              {info(o.email, <a href={`mailto:${order.email}`} className="hover:underline">{order.email}</a>, true)}
              {info(o.phone, <a href={`tel:${order.phone}`} className="hover:underline">{order.phone}</a>, true)}
              {info(o.address, [order.address, order.city, order.country].filter(Boolean).join(lang === "ar" ? "، " : ", "))}
              {info(o.notes, order.notes)}
              {info(o.language, isLocale(order.locale) ? LOCALE_NAMES[order.locale] : order.locale)}
              {info(o.shownIn, shown)}
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={o.status}>
            <form action={updateOrderStatus} className="flex gap-2">
              <input type="hidden" name="id" value={order.id} />
              <select name="status" defaultValue={order.status} className={inputCls}>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
              </select>
              <button className={btnCls}>{t.common.update}</button>
            </form>
          </Card>

          <Card title={o.payment}>
            <dl className="text-sm">
              {info(o.created, dateFmt.format(order.createdAt))}
              {info(o.paidAt, order.paidAt && dateFmt.format(order.paidAt))}
              {info(o.paymobOrder, order.paymobOrderId, true)}
              {info(o.transaction, order.paymobTransactionId, true)}
              {info(o.reference, order.paymentReference, true)}
            </dl>
            {!order.paymobOrderId && <p className="mt-2 text-xs text-zinc-500">{o.offline}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
