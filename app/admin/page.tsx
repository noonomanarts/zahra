import Link from "next/link";
import { count, desc, eq, inArray, sum } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/currency";
import { getCurrencySettings } from "@/lib/currency-server";
import { getAdminT } from "@/lib/i18n/admin-server";
import { paymobEnabled } from "@/lib/paymob";
import { Badge, Card, Notice, PageTitle, Stat, btnCls, btnSecondaryCls } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { Count } from "@/components/admin/motion";
import { REQUEST_BADGE } from "./requests/badges";

export default async function DashboardPage() {
  const admin = await requireAdmin();
  const { lang, t } = await getAdminT();
  const d = t.dashboard;
  const PAID = ["paid", "processing", "shipped", "completed"] as const;
  const [[products], [orders], [awaiting], [revenue], [noArabic], recent, currency, [newRequests], requests] = await Promise.all([
    db.select({ n: count() }).from(schema.products),
    db.select({ n: count() }).from(schema.orders),
    db.select({ n: count() }).from(schema.orders).where(eq(schema.orders.status, "paid")),
    db.select({ total: sum(schema.orders.total) }).from(schema.orders).where(inArray(schema.orders.status, [...PAID])),
    db.select({ n: count() }).from(schema.products).where(eq(schema.products.nameAr, "")),
    db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)).limit(6),
    getCurrencySettings(),
    db.select({ n: count() }).from(schema.serviceRequests).where(eq(schema.serviceRequests.status, "new")),
    db.select().from(schema.serviceRequests).orderBy(desc(schema.serviceRequests.createdAt)).limit(5),
  ]);
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Muscat" });
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Muscat" }).format(new Date()));
  const greeting = hour < 12 ? d.morning : hour < 18 ? d.afternoon : d.evening;
  const currencyLabel = lang === "ar" ? " ر.ع." : "OMR ";

  const quick = [
    { href: "/admin/products/new", label: d.quickProduct, icon: "plus" as const },
    { href: "/admin/requests?status=new", label: d.quickRequests, icon: "requests" as const },
    { href: "/admin/finance", label: d.quickFinance, icon: "finance" as const },
    { href: "/admin/pages/home", label: d.quickHome, icon: "pages" as const },
  ];

  return (
    <>
      <PageTitle
        title={`${greeting} 👋`}
        description={d.subtitle(admin.name || admin.email)}
        actions={
          <>
            <Link href="/admin/orders" className={btnSecondaryCls}><Icon name="orders" size={16} /> {t.nav.orders}</Link>
            <Link href="/admin/products/new" className={btnCls}><Icon name="plus" size={16} /> {t.products.add}</Link>
          </>
        }
      />

      <div className="space-y-3">
        {!paymobEnabled() && <Notice>{d.paymentOff}</Notice>}
        {newRequests.n > 0 && (
          <Notice tone="sky" action={<Link href="/admin/requests?status=new" className={btnSecondaryCls}>{d.openRequests}</Link>}>{d.newRequests(newRequests.n)}</Notice>
        )}
        {currency.pending && <Notice action={<Link href="/admin/currencies" className={btnSecondaryCls}>{d.reviewRates}</Link>}>{d.ratesPending}</Notice>}
        {noArabic.n > 0 && (
          <Notice action={<Link href="/admin/products?missing=ar" className={btnSecondaryCls}>{t.nav.products}</Link>}>{d.missingArabic(noArabic.n)}</Notice>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={d.revenue}
          tone="emerald"
          icon={<Icon name="wallet" />}
          value={<Count value={Number(revenue.total ?? 0)} decimals={3} prefix={lang === "ar" ? undefined : currencyLabel} suffix={lang === "ar" ? currencyLabel : undefined} />}
        />
        <Stat label={d.orders} tone="sky" icon={<Icon name="orders" />} value={<Count value={orders.n} />} />
        <Stat label={d.awaiting} tone="amber" icon={<Icon name="clock" />} value={<Count value={awaiting.n} />} hint={awaiting.n ? <Link href="/admin/orders?status=paid" className="underline-offset-2 hover:underline">{d.viewAll}</Link> : undefined} />
        <Stat label={d.products} tone="rose" icon={<Icon name="box" />} value={<Count value={products.n} />} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card title={d.recent} actions={<Link href="/admin/orders" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">{d.viewAll}</Link>} flush>
          {recent.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-zinc-100">
                  {recent.map((o) => (
                    <tr key={o.id} className="transition-colors hover:bg-zinc-50/80">
                      <td className="px-5 py-3"><Link href={`/admin/orders/${o.id}`} className="font-medium text-zinc-900 hover:underline" dir="ltr">{o.number}</Link></td>
                      <td className="px-5 py-3 text-zinc-600">{o.customerName}<span className="block text-xs text-zinc-400">{dateFmt.format(o.createdAt)}</span></td>
                      <td className="px-5 py-3"><Badge status={o.status} label={t.status[o.status]} /></td>
                      <td className="px-5 py-3 text-end font-medium whitespace-nowrap"><bdi>{formatMoney(o.total, "OMR", lang)}</bdi></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="orders" text={d.noOrders} />
          )}
        </Card>

        <div className="space-y-6">
          <Card title={t.nav.requests} actions={<Link href="/admin/requests" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">{d.viewAll}</Link>} flush>
            {requests.length ? (
              <ul className="divide-y divide-zinc-100">
                {requests.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/requests/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-zinc-50/80">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-zinc-900">{r.name}</span>
                        <span className="block text-xs text-zinc-500">{t.requests.types[r.type]} · <span dir="ltr">{r.number}</span></span>
                      </span>
                      <Badge status={REQUEST_BADGE[r.status]} label={t.requests.statuses[r.status]} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="requests" text={t.requests.none} />
            )}
          </Card>

          <Card title={d.quick}>
            <div className="grid grid-cols-2 gap-2">
              {quick.map((q) => (
                <Link key={q.href} href={q.href} className="group flex flex-col gap-2 rounded-xl border border-zinc-200/80 p-3 text-sm font-medium text-zinc-700 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-sm motion-reduce:transform-none">
                  <span className="grid size-8 place-items-center rounded-lg bg-zinc-100 text-zinc-600 transition-colors group-hover:bg-zinc-900 group-hover:text-white">
                    <Icon name={q.icon} size={16} />
                  </span>
                  {q.label}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Empty({ icon, text }: { icon: "orders" | "requests"; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-400"><Icon name={icon} size={22} /></span>
      <p className="text-sm text-zinc-500">{text}</p>
    </div>
  );
}
