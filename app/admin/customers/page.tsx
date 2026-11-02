import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/currency";
import { getAdminT } from "@/lib/i18n/admin-server";
import { can } from "@/lib/permissions";
import { Badge, PageTitle, Pagination, Stat, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { Count, SlidingTabs } from "@/components/admin/motion";
import { Avatar, likeTerm, timeAgo } from "@/components/admin/people";
import { customerStats } from "./stats";

export const metadata: Metadata = { title: "Customers" };

const PER_PAGE = 25;
const TABS = ["all", "buyers", "noOrders", "suspended"] as const;
const SORTS = ["newest", "spent", "recent", "name"] as const;
const EXPORT_URL = "/admin/customers/export";
const daysAgo = (days: number) => new Date(Date.now() - days * 864e5);

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const admin = await requireAdmin("customers.view");
  const { lang, t } = await getAdminT();
  const k = t.customers;
  const raw = (await searchParams) as { q?: string; tab?: string; sort?: string; page?: string };
  const term = (raw.q ?? "").trim().slice(0, 100);
  const tab = TABS.find((x) => x === raw.tab) ?? "all";
  const sort = SORTS.find((x) => x === raw.sort) ?? "newest";
  const c = schema.customers;
  const stats = customerStats();

  const search = term ? sql`(${c.name} LIKE ${likeTerm(term)} ESCAPE '\\' OR ${c.email} LIKE ${likeTerm(term)} ESCAPE '\\')` : undefined;
  const tabFilters = {
    all: undefined,
    buyers: gt(stats.paidOrders, 0),
    noOrders: isNull(stats.customerId),
    suspended: isNotNull(c.disabledAt),
  };
  const where = and(search, tabFilters[tab]);
  const counted = (filter: ReturnType<typeof and>) => db.select({ n: count() }).from(c).leftJoin(stats, eq(stats.customerId, c.id)).where(filter).then(([r]) => r.n);
  const [total, fresh, buyers, noOrders, suspended, matches] = await Promise.all([
    counted(undefined),
    counted(gt(c.createdAt, daysAgo(30))),
    counted(tabFilters.buyers),
    counted(tabFilters.noOrders),
    counted(tabFilters.suspended),
    counted(where),
  ]);
  const pages = Math.max(1, Math.ceil(matches / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1));
  const order = {
    newest: [desc(c.createdAt), desc(c.id)],
    spent: [sql`coalesce(${stats.spent}, 0) desc`, desc(c.createdAt)],
    recent: [sql`${stats.lastOrder} is null`, desc(stats.lastOrder), desc(c.createdAt)],
    name: [asc(c.name)],
  }[sort];
  const rows = await db
    .select({ id: c.id, name: c.name, email: c.email, createdAt: c.createdAt, disabledAt: c.disabledAt, orders: stats.orders, spent: stats.spent, lastOrder: stats.lastOrder })
    .from(c)
    .leftJoin(stats, eq(stats.customerId, c.id))
    .where(where)
    .orderBy(...order)
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE);

  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Muscat" });
  const href = (over: { tab?: string; page?: number }) => {
    const params = new URLSearchParams();
    const nextTab = over.tab ?? tab;
    if (term) params.set("q", term);
    if (nextTab !== "all") params.set("tab", nextTab);
    if (sort !== "newest") params.set("sort", sort);
    if (over.page && over.page > 1) params.set("page", String(over.page));
    const query = params.toString();
    return query ? `/admin/customers?${query}` : "/admin/customers";
  };

  return (
    <>
      <PageTitle
        title={k.title}
        description={k.subtitle}
        actions={can(admin.permissions, "customers.manage") && total > 0 ? <a href={EXPORT_URL} className={btnSecondaryCls}><Icon name="download" size={16} /> {k.export}</a> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={k.stats.total} tone="sky" icon={<Icon name="users" />} value={<Count value={total} />} />
        <Stat label={k.stats.fresh} tone="emerald" icon={<Icon name="userPlus" />} value={<Count value={fresh} />} />
        <Stat label={k.stats.buyers} tone="rose" icon={<Icon name="wallet" />} value={<Count value={buyers} />} hint={total ? k.stats.buyersHint(Math.round((buyers / total) * 100)) : undefined} />
        <Stat label={k.stats.suspended} tone="amber" icon={<Icon name="ban" />} value={<Count value={suspended} />} hint={k.stats.suspendedHint} />
      </div>

      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
        <SlidingTabs
          ariaLabel={k.title}
          value={tab}
          items={[
            { value: "all", label: k.tabs.all, href: href({ tab: "all" }), count: total },
            { value: "buyers", label: k.tabs.buyers, href: href({ tab: "buyers" }), count: buyers },
            { value: "noOrders", label: k.tabs.noOrders, href: href({ tab: "noOrders" }), count: noOrders },
            { value: "suspended", label: k.tabs.suspended, href: href({ tab: "suspended" }), count: suspended },
          ]}
        />
        <form className="flex flex-wrap items-center gap-2">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          <div className="relative min-w-56">
            <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input type="search" name="q" defaultValue={term} aria-label={k.search} placeholder={k.search} className={`${inputCls} ps-9`} />
          </div>
          <select name="sort" aria-label={k.sort.label} defaultValue={sort} className={`${inputCls} w-auto!`}>
            {SORTS.map((s) => <option key={s} value={s}>{k.sort[s]}</option>)}
          </select>
          <button className={btnSecondaryCls}>{t.common.filter}</button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,16,16,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/70 text-xs font-medium tracking-wide text-zinc-500 uppercase rtl:tracking-normal">
              <tr>
                <th className="px-4 py-3 text-start">{k.columns.customer}</th>
                <th className="px-4 py-3 text-end">{k.columns.orders}</th>
                <th className="px-4 py-3 text-end">{k.columns.spent}</th>
                <th className="hidden px-4 py-3 text-start md:table-cell">{k.columns.lastOrder}</th>
                <th className="hidden px-4 py-3 text-start lg:table-cell">{k.columns.joined}</th>
                <th className="px-4 py-3 text-start">{k.columns.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-zinc-50/80">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${row.id}`} className="group flex items-center gap-3">
                      <Avatar name={row.name} email={row.email} muted={Boolean(row.disabledAt)} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-zinc-900 group-hover:underline">{row.name}</span>
                        <span className="block truncate text-xs text-zinc-500" dir="ltr">{row.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-end text-zinc-700 tabular-nums">{row.orders ?? 0}</td>
                  <td className="px-4 py-3 text-end whitespace-nowrap text-zinc-900"><bdi>{formatMoney(Number(row.spent ?? 0), "OMR", lang)}</bdi></td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-zinc-500 md:table-cell">{row.lastOrder ? timeAgo(new Date(row.lastOrder * 1000), lang) : "—"}</td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-zinc-500 lg:table-cell">{dateFmt.format(row.createdAt)}</td>
                  <td className="px-4 py-3">{row.disabledAt ? <Badge status="failed" label={k.status.suspended} /> : <Badge status="paid" label={k.status.active} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p className="p-10 text-center text-sm text-zinc-500">{total ? k.none : k.noneYet}</p>}
        <Pagination page={page} pages={pages} total={matches} perPage={PER_PAGE} href={(n) => href({ page: n })} labels={t.pagination} />
      </div>
    </>
  );
}
