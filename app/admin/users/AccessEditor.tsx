"use client";

import { useState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Icon } from "@/components/admin/icons";
import { ADMIN_ROLES, LEVELS, ROLE_PRESETS, SECTIONS, resolvePermissions, withinLimit, type AdminRole, type Level, type PermissionMap, type Section } from "@/lib/permissions";

const rank: Record<Level, number> = { none: 0, view: 1, manage: 2 };

/**
 * Role cards with the resulting access underneath; "Custom" makes the levels editable.
 * Choices beyond the actor's own access are switched off here and refused by the server too.
 */
export default function AccessEditor({ role: initialRole, permissions, actor }: { role: AdminRole; permissions: PermissionMap; actor: { role: string; permissions: PermissionMap } }) {
  const { t } = useAdminI18n();
  const p = t.people;
  const [role, setRole] = useState<AdminRole>(initialRole);
  const [custom, setCustom] = useState<PermissionMap>(permissions);
  const isOwner = actor.role === "owner";
  const shown = role === "custom" ? custom : resolvePermissions(role);
  const allowed = (r: AdminRole) => {
    if (r === "custom") return true;
    if (isOwner) return true;
    return r !== "owner" && withinLimit(ROLE_PRESETS[r], actor.permissions);
  };
  const levelAllowed = (s: Section, l: Level) => isOwner || rank[l] <= rank[actor.permissions[s]];

  const choose = (next: AdminRole) => {
    // switching to custom starts from the access just on screen, so a preset is easy to adjust
    if (next === "custom") setCustom(shown);
    setRole(next);
  };

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="sr-only">{p.access}</legend>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {ADMIN_ROLES.map((r) => {
            const off = !allowed(r);
            return (
              <label key={r} className={`relative block ${off ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}>
                <input type="radio" name="role" value={r} checked={role === r} disabled={off} onChange={() => choose(r)} className="peer sr-only" />
                <span className="block h-full rounded-xl border border-zinc-200 bg-white p-3.5 transition peer-checked:border-zinc-900 peer-checked:ring-1 peer-checked:ring-zinc-900 peer-focus-visible:ring-2 peer-focus-visible:ring-brand hover:border-zinc-300">
                  <span className="block pe-6 text-sm font-semibold text-zinc-900">{p.roles[r]}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{p.roleInfo[r]}</span>
                </span>
                <span className="absolute end-3 top-3.5 hidden size-5 place-items-center rounded-full bg-zinc-900 text-white peer-checked:grid" aria-hidden="true"><Icon name="check" size={12} strokeWidth={3} /></span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="overflow-hidden rounded-xl border border-zinc-200/80">
        <ul className="divide-y divide-zinc-100">
          {SECTIONS.map((s) => (
            <li key={s} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-sm font-medium text-zinc-800">{p.sections[s]}</p>
                <p className="text-xs text-zinc-500">{p.sectionInfo[s]}</p>
              </div>
              {role === "custom" ? (
                <fieldset className="inline-flex rounded-lg bg-zinc-100 p-0.5">
                  <legend className="sr-only">{p.sections[s]}</legend>
                  {LEVELS.map((l) => (
                    <label key={l} className={levelAllowed(s, l) ? "cursor-pointer" : "cursor-not-allowed opacity-40"}>
                      <input
                        type="radio"
                        name={`perm_${s}`}
                        value={l}
                        checked={custom[s] === l}
                        disabled={!levelAllowed(s, l)}
                        onChange={() => setCustom({ ...custom, [s]: l })}
                        className="peer sr-only"
                      />
                      <span className="block rounded-md px-3 py-1 text-xs font-medium text-zinc-500 transition peer-checked:bg-white peer-checked:text-zinc-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-brand">{p.levels[l]}</span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${shown[s] === "manage" ? "bg-zinc-900 text-white" : shown[s] === "view" ? "bg-sky-50 text-sky-800" : "text-zinc-400"}`}>{p.levels[shown[s]]}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
