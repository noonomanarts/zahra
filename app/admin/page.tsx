import Link from "next/link";
import { count, desc, eq, inArray, sum } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/currency";
import { getCurrencySettings } from "@/lib/currency-server";
import { getAdminT } from "@/lib/i18n/admin-server";
import { paymobEnabled } from "@/lib/paymob";
import { Badge, Card, PageTitle, btnSecondaryCls } from "@/components/admin/ui";

export default async function DashboardPage() {
  await requireAdmin();
  const { lang, t } = await getAdminT();
  const PAID = ["paid", "processing", "shipped", "completed"] as const;
  const [[products], [orders], [awaiting], [revenue], [noArabic], recent, currency] = await Promise.all([
    db.select({ n: count() }).from(schema.products),
    db.select({ n: count() }).from(schema.orders),
    db.select({ n: count() }).from(schema.orders).where(eq(schema.orders.status, "paid")),
    db.select({ total: sum(schema.orders.total) }).from(schema.orders).where(inArray(schema.orders.status, [...PAID])),
    db.select({ n: count() }).from(schema.products).where(eq(schema.products.nameAr, "")),
    db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)).limit(8),
    getCurrencySettings(),
  ]);

  const stats = [
    { label: t.dashboard.revenue, value: formatMoney(Number(revenue.total ?? 0), "OMR", lang) },
    { label: t.dashboard.orders, value: orders.n },
    { label: t.dashboard.awaiting, value: awaiting.n },
    { label: t.dashboard.products, value: products.n },
  ];
  const notice = "mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900";

  return (
    <>
      <PageTitle title={t.nav.dashboard} />
      {!paymobEnabled() && <p className={notice}>{t.dashboard.paymentOff}</p>}
      {currency.pending && (
        <div className={notice}>
          {t.dashboard.ratesPending}
          <Link href="/admin/currencies" className={btnSecondaryCls}>{t.dashboard.reviewRates}</Link>
        </div>
      )}
      {noArabic.n > 0 && (
        <div className={notice}>
          {t.dashboard.missingArabic(noArabic.n)}
          <Link href="/admin/products?missing=ar" className={btnSecondaryCls}>{t.nav.products}</Link>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-5">
            <p className="text-sm text-zinc-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold" dir="ltr">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Card title={t.dashboard.recent} actions={<Link href="/admin/orders" className="text-sm text-zinc-600 hover:text-zinc-900">{t.dashboard.viewAll}</Link>}>
          {recent.length ? (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100">
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5"><Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline" dir="ltr">{o.number}</Link></td>
                    <td className="py-2.5 text-zinc-600">{o.customerName}</td>
                    <td className="py-2.5"><Badge status={o.status} label={t.status[o.status]} /></td>
                    <td className="py-2.5 text-end"><bdi>{formatMoney(o.total, "OMR", lang)}</bdi></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-zinc-500">{t.dashboard.noOrders}</p>
          )}
        </Card>
      </div>
    </>
  );
}
