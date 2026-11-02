import type { Metadata } from "next";
import { and, desc, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentSessionId, requireSession } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { SECTIONS } from "@/lib/permissions";
import { Card, Notice, PageTitle } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { LevelMark, RoleBadge, deviceLabel, timeAgo } from "@/components/admin/people";
import { PasswordForm, ProfileForm, SignOutOthers } from "./AccountForms";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const admin = await requireSession();
  const { lang, t } = await getAdminT();
  const a = t.account;
  const p = t.people;
  const sessions = await db.select().from(schema.sessions)
    .where(and(eq(schema.sessions.userId, admin.id), gt(schema.sessions.expiresAt, new Date())))
    .orderBy(desc(schema.sessions.lastSeenAt));
  const thisSession = await currentSessionId();

  return (
    <>
      <PageTitle title={a.title} description={a.subtitle} />
      {admin.mustChangePassword && <div className="mb-6"><Notice>{a.mustChange}</Notice></div>}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <PasswordForm />
          {!admin.mustChangePassword && <ProfileForm name={admin.name} email={admin.email} />}
        </div>

        {!admin.mustChangePassword && (
          <div className="space-y-6">
            <Card title={a.access} description={a.accessHint} actions={<RoleBadge role={admin.role} label={p.roles[admin.role]} />} flush>
              <ul className="divide-y divide-zinc-100">
                {SECTIONS.map((s) => (
                  <li key={s} className="flex items-center justify-between gap-4 px-5 py-2">
                    <span className="text-sm text-zinc-700">{p.sections[s]}</span>
                    <span className="flex items-center gap-2 text-xs text-zinc-500">{p.levels[admin.permissions[s]]} <LevelMark level={admin.permissions[s]} label={p.levels[admin.permissions[s]]} /></span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title={a.sessions} flush actions={sessions.length > 1 ? <SignOutOthers /> : undefined}>
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
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
