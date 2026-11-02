import type { Metadata } from "next";
import { count } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { ADMIN_ROLES, LEVELS, ROLE_PRESETS, SECTIONS, type AdminRole } from "@/lib/permissions";
import { Card, PageTitle } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { LevelMark, RoleBadge, TeamTabs } from "@/components/admin/people";

export const metadata: Metadata = { title: "Roles & access" };

export default async function RolesPage() {
  await requireAdmin("users.view");
  const { t } = await getAdminT();
  const p = t.people;
  const u = schema.adminUsers;
  const rows = await db.select({ role: u.role, n: count() }).from(u).groupBy(u.role);
  const people = new Map(rows.map((r) => [r.role, r.n]));
  const presets = ADMIN_ROLES.filter((r): r is Exclude<AdminRole, "custom"> => r !== "custom");

  return (
    <>
      <PageTitle title={p.rolesTitle} description={p.rolesSubtitle} />
      <TeamTabs t={t} value="roles" />

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_ROLES.map((r) => (
          <li key={r} className="zds-rise flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,16,16,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <RoleBadge role={r} label={p.roles[r]} />
              <span className="flex items-center gap-1 text-xs text-zinc-500"><Icon name="users" size={13} /> {p.rolePeople(people.get(r) ?? 0)}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">{p.roleInfo[r]}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card title={p.rolesMatrix} flush>
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/70 text-xs font-medium text-zinc-500">
                <tr>
                  <th scope="col" className="sticky start-0 z-10 bg-zinc-50 px-4 py-3 text-start">{p.section}</th>
                  {presets.map((r) => <th key={r} scope="col" className="px-2 py-3 text-center whitespace-nowrap">{p.roles[r]}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {SECTIONS.map((s) => (
                  <tr key={s} className="hover:bg-zinc-50/60">
                    <th scope="row" className="sticky start-0 z-10 min-w-44 bg-white px-4 py-2.5 text-start font-normal">
                      <span className="block font-medium text-zinc-800">{p.sections[s]}</span>
                      <span className="block text-xs text-zinc-500">{p.sectionInfo[s]}</span>
                    </th>
                    {presets.map((r) => (
                      <td key={r} className="px-2 py-2.5 text-center"><LevelMark level={ROLE_PRESETS[r][s]} label={p.levels[ROLE_PRESETS[r][s]]} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title={p.legend}>
            <ul className="space-y-3">
              {[...LEVELS].reverse().map((l) => (
                <li key={l} className="flex items-center gap-3">
                  <LevelMark level={l} label={p.levels[l]} />
                  <span className="text-sm"><span className="block font-medium text-zinc-800">{p.levels[l]}</span><span className="block text-xs text-zinc-500">{p.levelInfo[l]}</span></span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={p.rulesTitle}>
            <ul className="space-y-3 text-sm leading-relaxed text-zinc-600">
              {p.rules.map((rule) => (
                <li key={rule} className="flex gap-2.5"><Icon name="shield" size={16} className="mt-0.5 shrink-0 text-brand" />{rule}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
