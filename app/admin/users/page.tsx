import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { ADMIN_ROLES, SECTIONS, can, isAdminRole, resolvePermissions } from "@/lib/permissions";
import { Badge, PageTitle, Stat, btnCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { Count } from "@/components/admin/motion";
import { Avatar, RoleBadge, TeamTabs, likeTerm, timeAgo } from "@/components/admin/people";

export const metadata: Metadata = { title: "Team" };

const ONLINE_MINUTES = 15;

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const admin = await requireAdmin("users.view");
  const { lang, t } = await getAdminT();
  const p = t.people;
  const { q = "", role = "", status = "" } = (await searchParams) as { q?: string; role?: string; status?: string };
  const term = q.trim().slice(0, 100);
  const u = schema.adminUsers;

  const filters = and(
    term ? sql`(${u.name} LIKE ${likeTerm(term)} ESCAPE '\\' OR ${u.email} LIKE ${likeTerm(term)} ESCAPE '\\')` : undefined,
    isAdminRole(role) ? eq(u.role, role) : undefined,
    status === "active" ? eq(u.active, true) : status === "disabled" ? eq(u.active, false) : status === "pending" ? eq(u.mustChangePassword, true) : undefined,
  );
  const [list, everyone, sessionCounts] = await Promise.all([
    db.select().from(u).where(filters).orderBy(desc(u.active), desc(u.createdAt)),
    db.select({ role: u.role, active: u.active, mustChangePassword: u.mustChangePassword, lastSeenAt: u.lastSeenAt }).from(u),
    db.select({ userId: schema.sessions.userId, n: count() }).from(schema.sessions).where(sql`${schema.sessions.expiresAt} > unixepoch()`).groupBy(schema.sessions.userId),
  ]);
  const devices = new Map(sessionCounts.map((s) => [s.userId, s.n]));
  const now = new Date();
  const online = everyone.filter((x) => x.active && x.lastSeenAt && now.getTime() - x.lastSeenAt.getTime() < ONLINE_MINUTES * 60_000).length;
  const active = everyone.filter((x) => x.active).length;
  const owners = everyone.filter((x) => x.role === "owner" && x.active).length;
  const pending = everyone.filter((x) => x.active && x.mustChangePassword).length;
  const filtered = Boolean(term || isAdminRole(role) || status);
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Muscat" });

  return (
    <>
      <PageTitle
        title={p.title}
        description={p.subtitle}
        actions={can(admin.permissions, "users.manage") ? <Link href="/admin/users/new" className={btnCls}><Icon name="userPlus" size={16} /> {p.add}</Link> : undefined}
      />
      <TeamTabs t={t} value="team" count={everyone.length} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={p.stats.total} tone="sky" icon={<Icon name="users" />} value={<Count value={everyone.length} />} hint={p.activeOf(active, everyone.length)} />
        <Stat label={p.stats.owners} tone="rose" icon={<Icon name="shield" />} value={<Count value={owners} />} hint={p.stats.ownersHint} />
        <Stat label={p.stats.online} tone="emerald" icon={<Icon name="activity" />} value={<Count value={online} />} hint={p.stats.onlineHint} />
        <Stat label={p.stats.pending} tone="amber" icon={<Icon name="key" />} value={<Count value={pending} />} hint={p.stats.pendingHint} />
      </div>

      <form className="mt-6 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="search" name="q" defaultValue={term} aria-label={p.search} placeholder={p.search} className={`${inputCls} ps-9`} />
        </div>
        <select name="role" aria-label={p.columns.role} defaultValue={isAdminRole(role) ? role : ""} className={`${inputCls} w-auto!`}>
          <option value="">{p.allRoles}</option>
          {ADMIN_ROLES.map((r) => <option key={r} value={r}>{p.roles[r]}</option>)}
        </select>
        <select name="status" aria-label={p.columns.status} defaultValue={status} className={`${inputCls} w-auto!`}>
          <option value="">{p.allStatuses}</option>
          <option value="active">{p.status.active}</option>
          <option value="pending">{p.status.pending}</option>
          <option value="disabled">{p.status.disabled}</option>
        </select>
        <button className={btnSecondaryCls}>{t.common.filter}</button>
        {filtered && <Link href="/admin/users" className="px-2 text-sm text-zinc-500 hover:text-zinc-900 hover:underline">{p.clearFilters}</Link>}
      </form>

      <div className="relative overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,16,16,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50/70 text-xs font-medium tracking-wide text-zinc-500 uppercase rtl:tracking-normal">
            <tr>
              <th className="px-4 py-3 text-start">{p.columns.person}</th>
              <th className="px-4 py-3 text-start">{p.columns.role}</th>
              <th className="hidden px-4 py-3 text-start lg:table-cell">{p.columns.access}</th>
              <th className="px-4 py-3 text-start">{p.columns.status}</th>
              <th className="hidden px-4 py-3 text-start md:table-cell">{p.columns.lastActive}</th>
              <th className="hidden px-4 py-3 text-start xl:table-cell">{p.columns.added}</th>
              <th className="px-4 py-3"><span className="sr-only">{p.manage}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {list.map((row) => {
              const map = resolvePermissions(row.role, row.permissions);
              const reach = SECTIONS.filter((s) => map[s] !== "none").length;
              const full = SECTIONS.every((s) => map[s] === "manage");
              const signedIn = devices.get(row.id) ?? 0;
              return (
                <tr key={row.id} className={`transition-colors hover:bg-zinc-50/80 ${row.active ? "" : "bg-zinc-50/50"}`}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${row.id}`} className="group flex items-center gap-3">
                      <Avatar name={row.name} email={row.email} muted={!row.active} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium text-zinc-900 group-hover:underline">
                          <span className="truncate">{row.name}</span>
                          {row.id === admin.id && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 no-underline">{p.you}</span>}
                        </span>
                        <span className="block truncate text-xs text-zinc-500" dir="ltr">{row.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={row.role} label={p.roles[row.role]} /></td>
                  <td className="hidden px-4 py-3 text-xs text-zinc-500 lg:table-cell">{full ? p.fullAccess : p.sectionsCount(reach)}</td>
                  <td className="px-4 py-3">
                    {!row.active ? <Badge status="cancelled" label={p.status.disabled} /> : row.mustChangePassword ? <Badge status="warning" label={p.status.pending} /> : <Badge status="paid" label={p.status.active} />}
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-zinc-500 md:table-cell">
                    {row.lastSeenAt ? timeAgo(row.lastSeenAt, lang) : p.never}
                    {signedIn > 0 && <span className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400"><Icon name="devices" size={13} /> {signedIn}</span>}
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-zinc-500 xl:table-cell">{dateFmt.format(row.createdAt)}</td>
                  <td className="px-4 py-3 text-end">
                    <Link href={`/admin/users/${row.id}`} aria-label={`${p.manage}: ${row.name}`} className="inline-grid size-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900">
                      <Icon name="chevron" size={16} className="rtl:-scale-x-100" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!list.length && <p className="p-10 text-center text-sm text-zinc-500">{p.none}</p>}
      </div>
    </>
  );
}
