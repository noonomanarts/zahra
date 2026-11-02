import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { pick } from "@/lib/i18n/config";
import { can } from "@/lib/permissions";
import { Card, PageTitle, btnCls, inputCls } from "@/components/admin/ui";
import { Icon, type IconName } from "@/components/admin/icons";
import { likeTerm } from "@/components/admin/people";

export const metadata: Metadata = { title: "Search" };

const LIMIT = 8;

/** Searches every section the signed-in person may open, and only those. */
export default async function SearchPage({ searchParams }: PageProps<"/admin/search">) {
  const admin = await requireAdmin();
  const { lang, t } = await getAdminT();
  const s = t.search;
  const { q = "" } = (await searchParams) as { q?: string };
  const term = q.trim().slice(0, 100);
  const like = likeTerm(term);
  const has = can.bind(null, admin.permissions);
  const { orders: o, customers: c, products: p, serviceRequests: r, adminUsers: u } = schema;

  const [orders, customers, products, workshops, requests, team] = term
    ? await Promise.all([
        has("orders.view") ? db.select().from(o).where(sql`(${o.number} LIKE ${like} ESCAPE '\\' OR ${o.customerName} LIKE ${like} ESCAPE '\\' OR ${o.email} LIKE ${like} ESCAPE '\\' OR ${o.phone} LIKE ${like} ESCAPE '\\')`).orderBy(desc(o.createdAt)).limit(LIMIT) : [],
        has("customers.view") ? db.select().from(c).where(sql`(${c.name} LIKE ${like} ESCAPE '\\' OR ${c.email} LIKE ${like} ESCAPE '\\')`).orderBy(desc(c.createdAt)).limit(LIMIT) : [],
        has("products.view") ? db.select().from(p).where(and(eq(p.kind, "product"), sql`(${p.name} LIKE ${like} ESCAPE '\\' OR ${p.nameAr} LIKE ${like} ESCAPE '\\' OR ${p.sku} LIKE ${like} ESCAPE '\\')`)).limit(LIMIT) : [],
        has("workshops.view") ? db.select().from(p).where(and(eq(p.kind, "workshop"), sql`(${p.name} LIKE ${like} ESCAPE '\\' OR ${p.nameAr} LIKE ${like} ESCAPE '\\')`)).limit(LIMIT) : [],
        has("requests.view") ? db.select().from(r).where(sql`(${r.number} LIKE ${like} ESCAPE '\\' OR ${r.name} LIKE ${like} ESCAPE '\\' OR ${r.email} LIKE ${like} ESCAPE '\\' OR ${r.phone} LIKE ${like} ESCAPE '\\')`).orderBy(desc(r.createdAt)).limit(LIMIT) : [],
        has("users.view") ? db.select().from(u).where(sql`(${u.name} LIKE ${like} ESCAPE '\\' OR ${u.email} LIKE ${like} ESCAPE '\\')`).limit(LIMIT) : [],
      ])
    : [[], [], [], [], [], []];

  const groups = ([
    { title: t.nav.orders, icon: "orders", rows: orders.map((x) => ({ href: `/admin/orders/${x.id}`, title: x.number, detail: `${x.customerName} · ${x.email}` })) },
    { title: t.nav.customers, icon: "users", rows: customers.map((x) => ({ href: `/admin/customers/${x.id}`, title: x.name, detail: x.email })) },
    { title: t.nav.products, icon: "products", rows: products.map((x) => ({ href: `/admin/products/${x.id}`, title: pick({ en: x.name, ar: x.nameAr }, lang), detail: x.sku ?? "" })) },
    { title: t.nav.workshops, icon: "workshops", rows: workshops.map((x) => ({ href: `/admin/workshops/${x.id}`, title: pick({ en: x.name, ar: x.nameAr }, lang), detail: x.sku ?? "" })) },
    { title: t.nav.requests, icon: "requests", rows: requests.map((x) => ({ href: `/admin/requests/${x.id}`, title: x.number, detail: `${x.name} · ${x.email}` })) },
    { title: s.team, icon: "shield", rows: team.map((x) => ({ href: `/admin/users/${x.id}`, title: x.name, detail: x.email })) },
  ] as { title: string; icon: IconName; rows: { href: string; title: string; detail: string }[] }[]).filter((g) => g.rows.length);

  return (
    <>
      <PageTitle title={s.title} description={term ? s.results(term) : s.prompt} />
      <form className="mb-6 flex max-w-xl gap-2">
        <input type="search" name="q" defaultValue={term} required aria-label={s.label} placeholder={s.placeholder} className={inputCls} />
        <button className={btnCls}><Icon name="search" size={16} /> {s.title}</button>
      </form>
      {term && !groups.length && <p className="rounded-2xl border border-zinc-200/80 bg-white p-10 text-center text-sm text-zinc-500">{s.none}</p>}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.title} title={g.title} flush>
            <ul className="divide-y divide-zinc-100">
              {g.rows.map((row) => (
                <li key={row.href}>
                  <Link href={row.href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50/80">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500"><Icon name={g.icon} size={16} /></span>
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-medium text-zinc-900">{row.title}</span>
                      {row.detail && <span className="block truncate text-xs text-zinc-500" dir="ltr">{row.detail}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
