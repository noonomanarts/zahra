import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ORDER_STATUSES, type OrderStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/currency";
import { getAdminT } from "@/lib/i18n/admin-server";
import { Badge, PageTitle } from "@/components/admin/ui";
import { SlidingTabs } from "@/components/admin/motion";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const { lang, t } = await getAdminT();
  const o = t.orders;
  const { status } = (await searchParams) as { status?: string };
  const filter = ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : null;
  const orders = await db
    .select()
    .from(schema.orders)
    .where(filter ? eq(schema.orders.status, filter) : undefined)
    .orderBy(desc(schema.orders.createdAt));
  const counts = new Map(
    (await db.select({ status: schema.orders.status, n: count() }).from(schema.orders).groupBy(schema.orders.status)).map((r) => [r.status, r.n]),
  );
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" });

  return (
    <>
      <PageTitle title={o.title} />
      <div className="mb-4">
        <SlidingTabs
          ariaLabel={o.status}
          value={filter ?? "all"}
          items={[
            { value: "all", label: o.all, href: "/admin/orders" },
            ...ORDER_STATUSES.map((s) => ({ value: s, label: t.status[s], href: `/admin/orders?status=${s}`, count: counts.get(s) })),
          ]}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,16,16,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50/70 text-xs font-medium tracking-wide text-zinc-500 uppercase rtl:tracking-normal">
            <tr>
              <th className="px-4 py-3 text-start">{o.order}</th>
              <th className="px-4 py-3 text-start">{o.date}</th>
              <th className="px-4 py-3 text-start">{o.customer}</th>
              <th className="px-4 py-3 text-start">{o.status}</th>
              <th className="px-4 py-3 text-end">{o.total}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {orders.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-zinc-50/80">
                <td className="px-4 py-2.5"><Link href={`/admin/orders/${row.id}`} className="font-medium hover:underline" dir="ltr">{row.number}</Link></td>
                <td className="px-4 py-2.5 text-zinc-500">{dateFmt.format(row.createdAt)}</td>
                <td className="px-4 py-2.5">{row.customerName}<span className="block text-xs text-zinc-500" dir="ltr">{row.email}</span></td>
                <td className="px-4 py-2.5"><Badge status={row.status} label={t.status[row.status]} /></td>
                <td className="px-4 py-2.5 text-end whitespace-nowrap"><bdi>{formatMoney(row.total, "OMR", lang)}</bdi></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && <p className="p-6 text-center text-sm text-zinc-500">{o.none}</p>}
      </div>
    </>
  );
}
