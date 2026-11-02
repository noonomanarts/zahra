import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, gt, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentSessionId, requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { resolvePermissions, staffDenial } from "@/lib/permissions";
import { Badge, Card, Notice, PageTitle, btnSecondaryCls } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { Avatar, RoleBadge, deviceLabel, timeAgo } from "@/components/admin/people";
import UserActions from "../UserActions";
import UserForm from "../UserForm";

export const metadata: Metadata = { title: "Team member" };

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  const admin = await requireAdmin("users.view");
  const { lang, t } = await getAdminT();
  const p = t.people;
  const id = Number((await params).id);
  const user = Number.isInteger(id) ? await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, id) }) : undefined;
  if (!user) notFound();

  const permissions = resolvePermissions(user.role, user.permissions);
  const denied = staffDenial(admin, { id: user.id, role: user.role, permissions }, null);
  const log = schema.adminAuditLog;
  const [sessions, activity, thisSession] = await Promise.all([
    db.select().from(schema.sessions).where(and(eq(schema.sessions.userId, user.id), gt(schema.sessions.expiresAt, new Date()))).orderBy(desc(schema.sessions.lastSeenAt)),
    db.select().from(log).where(or(eq(log.actorId, user.id), and(eq(log.targetType, "user"), eq(log.targetId, user.id)))).orderBy(desc(log.createdAt), desc(log.id)).limit(8),
    currentSessionId(),
  ]);
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" });
  const when = (d: Date | null) => (d ? dateFmt.format(d) : p.never);
  const notice = denied === "self" ? p.selfNotice : denied === "ownerOnly" ? p.ownerOnlyNotice : denied === "exceeds" ? p.exceedsNotice : denied === "noPermission" ? p.readOnlyNotice : null;

  return (
    <>
      <PageTitle title={user.name} back="/admin/users" backLabel={p.back} />

      <div className="zds-rise mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,16,16,0.04)]">
        <Avatar name={user.name} email={user.email} large muted={!user.active} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-zinc-500" dir="ltr">{user.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RoleBadge role={user.role} label={p.roles[user.role]} />
            {!user.active ? <Badge status="cancelled" label={p.status.disabled} /> : user.mustChangePassword ? <Badge status="warning" label={p.status.pending} /> : <Badge status="paid" label={p.status.active} />}
          </div>
        </div>
      </div>

      {notice && (
        <div className="mb-6">
          <Notice tone="sky" action={denied === "self" ? <Link href="/admin/account" className={btnSecondaryCls}>{p.openAccount}</Link> : undefined}>{notice}</Notice>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <UserForm
          user={{ id: user.id, name: user.name, email: user.email, role: user.role, permissions }}
          actor={{ role: admin.role, permissions: admin.permissions }}
          locked={Boolean(denied)}
        />

        <div className="space-y-6">
          <Card title={p.security}>
            <dl className="space-y-2.5 text-sm">
              {[
                [p.lastLogin, when(user.lastLoginAt)],
                [p.lastSeen, user.lastSeenAt ? timeAgo(user.lastSeenAt, lang) : p.never],
                [p.passwordChanged, when(user.passwordChangedAt)],
                [p.created, when(user.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-zinc-500">{label}</dt>
                  <dd className="text-end text-zinc-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {!denied && (
            <Card title={p.dangerZone}>
              <UserActions id={user.id} name={user.name} active={user.active} />
            </Card>
          )}

          <Card title={p.sessions} flush>
            {sessions.length ? (
              <ul className="divide-y divide-zinc-100">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500"><Icon name="devices" size={16} /></span>
                    <span className="min-w-0 text-sm">
                      <span className="flex flex-wrap items-center gap-2 font-medium text-zinc-900">
                        {deviceLabel(s.userAgent, p.unknownDevice)}
                        {s.id === thisSession && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{p.thisDevice}</span>}
                      </span>
                      <span className="block text-xs text-zinc-500">{s.lastSeenAt && timeAgo(s.lastSeenAt, lang)}{s.ip ? <> · <bdi dir="ltr">{s.ip}</bdi></> : null}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-sm text-zinc-500">{p.sessionsEmpty}</p>
            )}
          </Card>

          <Card title={p.recentActivity} actions={<Link href={`/admin/users/activity?q=${encodeURIComponent(user.email)}`} className="text-sm font-medium text-zinc-500 hover:text-zinc-900">{p.viewAllActivity}</Link>} flush>
            {activity.length ? (
              <ul className="divide-y divide-zinc-100">
                {activity.map((a) => (
                  <li key={a.id} className="px-5 py-2.5 text-sm">
                    <span className="block text-zinc-800">{p.events[a.action] ?? a.action}</span>
                    <span className="block text-xs text-zinc-500">{timeAgo(a.createdAt, lang)}{a.actorId !== user.id && a.actorEmail ? <> · <bdi dir="ltr">{a.actorEmail}</bdi></> : null}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-sm text-zinc-500">{p.noActivity}</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
