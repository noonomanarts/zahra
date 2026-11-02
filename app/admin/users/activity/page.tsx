import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, like, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { PageTitle, Pagination, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { Icon, type IconName } from "@/components/admin/icons";
import { TeamTabs, likeTerm } from "@/components/admin/people";

export const metadata: Metadata = { title: "Activity log" };

const PER_PAGE = 30;
const GROUPS = {
  auth: ["auth.%"],
  user: ["user.%"],
  customer: ["customer%"],
  sales: ["order%", "request.%", "finance.%", "coupon.%", "payments.%"],
  catalogue: ["product.%", "workshop.%", "term.%", "review.%"],
  site: ["page.%", "settings.%", "currency.%", "email.%"],
} as const;

const eventStyle = (action: string): { icon: IconName; cls: string } => {
  if (action === "auth.login_failed") return { icon: "alert", cls: "bg-red-50 text-red-600" };
  if (action.endsWith("deleted") || action.endsWith("disabled")) return { icon: "ban", cls: "bg-amber-50 text-amber-700" };
  if (action.startsWith("auth.")) return { icon: "key", cls: "bg-zinc-100 text-zinc-600" };
  if (action.includes("role_changed")) return { icon: "shield", cls: "bg-brand-soft text-brand-ink" };
  if (action.startsWith("email.")) return { icon: "mail", cls: "bg-sky-50 text-sky-700" };
  if (action.startsWith("coupon.")) return { icon: "ticket", cls: "bg-emerald-50 text-emerald-700" };
  if (action.startsWith("review.")) return { icon: "star", cls: "bg-amber-50 text-amber-700" };
  if (action.startsWith("payments.")) return { icon: "card", cls: "bg-brand-soft text-brand-ink" };
  if (action.startsWith("order")) return { icon: "orders", cls: "bg-sky-50 text-sky-700" };
  if (action.startsWith("request.")) return { icon: "requests", cls: "bg-sky-50 text-sky-700" };
  if (action.startsWith("finance.")) return { icon: "finance", cls: "bg-emerald-50 text-emerald-700" };
  if (action.startsWith("product.") || action.startsWith("term.")) return { icon: "products", cls: "bg-rose-50 text-rose-700" };
  if (action.startsWith("workshop.")) return { icon: "workshops", cls: "bg-rose-50 text-rose-700" };
  if (action.startsWith("page.")) return { icon: "pages", cls: "bg-zinc-100 text-zinc-600" };
  if (action.startsWith("settings.")) return { icon: "settings", cls: "bg-zinc-100 text-zinc-600" };
  if (action.startsWith("currency.")) return { icon: "currencies", cls: "bg-zinc-100 text-zinc-600" };
  return { icon: "users", cls: "bg-sky-50 text-sky-700" };
};

export default async function ActivityPage({ searchParams }: PageProps<"/admin/users/activity">) {
  await requireAdmin("users.view");
  const { lang, t } = await getAdminT();
  const p = t.people;
  const { q = "", group = "", page: rawPage } = (await searchParams) as { q?: string; group?: string; page?: string };
  const term = q.trim().slice(0, 100);
  const log = schema.adminAuditLog;
  const patterns = Object.hasOwn(GROUPS, group) ? GROUPS[group as keyof typeof GROUPS] : null;
  const where = and(
    term ? sql`(${log.actorEmail} LIKE ${likeTerm(term)} ESCAPE '\\' OR ${log.targetLabel} LIKE ${likeTerm(term)} ESCAPE '\\')` : undefined,
    patterns ? or(...patterns.map((pattern) => like(log.action, pattern))) : undefined,
  );
  const [{ total }] = await db.select({ total: count() }).from(log).where(where);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1));
  const rows = await db.select().from(log).where(where).orderBy(desc(log.createdAt), desc(log.id)).limit(PER_PAGE).offset((page - 1) * PER_PAGE);
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" });
  const href = (n: number) => {
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (patterns) params.set("group", group);
    if (n > 1) params.set("page", String(n));
    const query = params.toString();
    return query ? `/admin/users/activity?${query}` : "/admin/users/activity";
  };

  return (
    <>
      <PageTitle title={p.activityTitle} description={p.activitySubtitle} />
      <TeamTabs t={t} value="activity" />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="search" name="q" defaultValue={term} aria-label={p.activitySearch} placeholder={p.activitySearch} className={`${inputCls} ps-9`} />
        </div>
        <select name="group" aria-label={p.allEvents} defaultValue={patterns ? group : ""} className={`${inputCls} w-auto!`}>
          <option value="">{p.allEvents}</option>
          {Object.keys(GROUPS).map((g) => <option key={g} value={g}>{p.eventGroups[g]}</option>)}
        </select>
        <button className={btnSecondaryCls}>{t.common.filter}</button>
        {(term || patterns) && <Link href="/admin/users/activity" className="px-2 text-sm text-zinc-500 hover:text-zinc-900 hover:underline">{p.clearFilters}</Link>}
      </form>

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,16,16,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/70 text-xs font-medium tracking-wide text-zinc-500 uppercase rtl:tracking-normal">
              <tr>
                <th className="px-4 py-3 text-start">{p.activityColumns.event}</th>
                <th className="px-4 py-3 text-start">{p.activityColumns.who}</th>
                <th className="px-4 py-3 text-start">{p.activityColumns.target}</th>
                <th className="px-4 py-3 text-start">{p.activityColumns.when}</th>
                <th className="hidden px-4 py-3 text-start lg:table-cell">{p.activityColumns.ip}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row) => {
                const style = eventStyle(row.action);
                const names = row.action === "order.status_changed" ? t.status : p.roles;
                const change = row.details?.from && row.details?.to ? `${names[row.details.from] ?? row.details.from} → ${names[row.details.to] ?? row.details.to}` : row.details?.to ? names[row.details.to] ?? row.details.to : null;
                return (
                  <tr key={row.id} className="hover:bg-zinc-50/80">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${style.cls}`}><Icon name={style.icon} size={14} /></span>
                        <span className="font-medium whitespace-nowrap text-zinc-900">{p.events[row.action] ?? row.action}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600"><bdi dir="ltr">{row.actorEmail || p.system}</bdi></td>
                    <td className="px-4 py-2.5 text-zinc-600">
                      {row.targetLabel ? <bdi dir="ltr">{row.targetLabel}</bdi> : <span className="text-zinc-300">—</span>}
                      {change && <span className="block text-xs text-zinc-500">{change}</span>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-zinc-500">{dateFmt.format(row.createdAt)}</td>
                    <td className="hidden px-4 py-2.5 font-mono text-xs text-zinc-400 lg:table-cell" dir="ltr">{row.ip ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && <p className="p-10 text-center text-sm text-zinc-500">{p.noActivity}</p>}
        <Pagination page={page} pages={pages} total={total} perPage={PER_PAGE} href={href} labels={t.pagination} />
      </div>
    </>
  );
}
