import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ORDER_STATUSES, type OrderStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/currency";
import { getAdminT } from "@/lib/i18n/admin-server";
import { Badge, PageTitle, Pagination, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { SlidingTabs } from "@/components/admin/motion";
import { likeTerm } from "@/components/admin/people";

export const metadata: Metadata = { title: "Orders" };

const PER_PAGE = 25;

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin("orders.view");
  const { lang, t } = await getAdminT();
  const o = t.orders;
  const { status, q = "", page: rawPage } = (await searchParams) as { status?: string; q?: string; page?: string };
  const filter = ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : null;
  const term = q.trim().slice(0, 100);
  const table = schema.orders;
  const where = and(
    filter ? eq(table.status, filter) : undefined,
    term ? sql`(${table.number} LIKE ${likeTerm(term)} ESCAPE '\\' OR ${table.customerName} LIKE ${likeTerm(term)} ESCAPE '\\' OR ${table.email} LIKE ${likeTerm(term)} ESCAPE '\\' OR ${table.phone} LIKE ${likeTerm(term)} ESCAPE '\\')` : undefined,
  );
  const [{ total }] = await db.select({ total: count() }).from(table).where(where);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1));
  const orders = await db.select().from(table).where(where).orderBy(desc(table.createdAt)).limit(PER_PAGE).offset((page - 1) * PER_PAGE);
  const query = (over: { status?: string | null; page?: number }) => {
    const params = new URLSearchParams();
    const nextStatus = over.status === undefined ? filter : over.status;
    if (nextStatus) params.set("status", nextStatus);
    if (term) params.set("q", term);
    if (over.page && over.page > 1) params.set("page", String(over.page));
    const text = params.toString();
    return text ? `?${text}` : "";
  };
  const counts = new Map(
    (await db.select({ status: schema.orders.status, n: count() }).from(schema.orders).groupBy(schema.orders.status)).map((r) => [r.status, r.n]),
  );
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" });

  return (
    <>
      <PageTitle title={o.title} actions={total > 0 ? <a href={`/admin/orders/export${query({})}`} className={btnSecondaryCls}><Icon name="download" size={16} /> {o.exportCsv}</a> : undefined} />
      <div className="mb-4">
        <SlidingTabs
          ariaLabel={o.status}
          value={filter ?? "all"}
          items={[
            { value: "all", label: o.all, href: `/admin/orders${query({ status: null })}` },
            ...ORDER_STATUSES.map((s) => ({ value: s, label: t.status[s], href: `/admin/orders${query({ status: s })}`, count: counts.get(s) })),
          ]}
        />
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        {filter && <input type="hidden" name="status" value={filter} />}
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="search" name="q" defaultValue={term} aria-label={o.search} placeholder={o.search} className={`${inputCls} ps-9`} />
        </div>
        <button className={btnSecondaryCls}>{t.common.filter}</button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,16,16,0.04)]">
        <div className="overflow-x-auto">
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
        </div>
        {!orders.length && <p className="p-6 text-center text-sm text-zinc-500">{o.none}</p>}
        <Pagination page={page} pages={pages} total={total} perPage={PER_PAGE} href={(n) => `/admin/orders${query({ page: n })}`} labels={t.pagination} />
      </div>
    </>
  );
}
