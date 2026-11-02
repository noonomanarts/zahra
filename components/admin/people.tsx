import type { AdminDictionary } from "@/lib/i18n/admin";
import type { Level } from "@/lib/permissions";
import { Icon } from "./icons";
import { SlidingTabs } from "./motion";

/** Shared pieces of the team and customer pages. */
export const PERSON_ROLE_TONES: Record<string, string> = {
  owner: "bg-brand-soft text-brand-ink ring-brand/30",
  admin: "bg-zinc-900 text-white ring-zinc-900",
  manager: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  sales: "bg-sky-50 text-sky-800 ring-sky-200",
  content: "bg-rose-50 text-rose-800 ring-rose-200",
  accountant: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  viewer: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  custom: "bg-amber-50 text-amber-800 ring-amber-200",
};

export function RoleBadge({ role, label }: { role: string; label: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${PERSON_ROLE_TONES[role] ?? PERSON_ROLE_TONES.viewer}`}>{label}</span>;
}

export function Avatar({ name, email, large, muted }: { name: string; email: string; large?: boolean; muted?: boolean }) {
  const letters = (name.trim() || email).split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-semibold uppercase ${large ? "size-14 text-lg" : "size-9 text-xs"} ${muted ? "bg-zinc-100 text-zinc-400" : "bg-gradient-to-br from-brand-soft to-zinc-100 text-brand-ink ring-1 ring-brand/15"}`}>
      {letters}
    </span>
  );
}

export function LevelMark({ level, label }: { level: Level; label: string }) {
  if (level === "manage") return <span className="inline-flex size-7 items-center justify-center rounded-full bg-zinc-900 text-white" title={label}><Icon name="check" size={14} strokeWidth={2.4} /><span className="sr-only">{label}</span></span>;
  if (level === "view") return <span className="inline-flex size-7 items-center justify-center rounded-full bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200" title={label}><Icon name="eye" size={14} /><span className="sr-only">{label}</span></span>;
  return <span className="inline-flex size-7 items-center justify-center text-zinc-300" title={label}><span aria-hidden="true">—</span><span className="sr-only">{label}</span></span>;
}

export function TeamTabs({ t, value, count }: { t: AdminDictionary; value: "team" | "roles" | "activity"; count?: number }) {
  const tabs = t.people.tabs;
  return (
    <div className="mb-6">
      <SlidingTabs
        ariaLabel={t.nav.users}
        value={value}
        items={[
          { value: "team", label: tabs.team, href: "/admin/users", count },
          { value: "roles", label: tabs.roles, href: "/admin/users/roles" },
          { value: "activity", label: tabs.activity, href: "/admin/users/activity" },
        ]}
      />
    </div>
  );
}

/** "3 hours ago", in the panel's language. */
export function timeAgo(date: Date, lang: string) {
  const fmt = new Intl.RelativeTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { numeric: "auto" });
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [[60, "second"], [3600, "minute"], [86400, "hour"], [2592000, "day"], [31536000, "month"]];
  for (let i = 0; i < steps.length; i++) {
    if (Math.abs(seconds) < steps[i][0]) {
      const unit = i ? steps[i - 1][0] : 1;
      return fmt.format(Math.round(seconds / unit), steps[i][1]);
    }
  }
  return fmt.format(Math.round(seconds / 31536000), "year");
}

/** "Chrome on macOS", good enough to recognise a device; never used for any security decision. */
export function deviceLabel(userAgent: string | null, fallback: string) {
  if (!userAgent) return fallback;
  const browser = /Edg\//.test(userAgent) ? "Edge" : /OPR\//.test(userAgent) ? "Opera" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : null;
  const os = /iPhone|iPad/.test(userAgent) ? "iOS" : /Android/.test(userAgent) ? "Android" : /Mac OS X/.test(userAgent) ? "macOS" : /Windows/.test(userAgent) ? "Windows" : /Linux/.test(userAgent) ? "Linux" : null;
  return [browser, os].filter(Boolean).join(" · ") || fallback;
}

/** LIKE pattern for a literal search term (used with ESCAPE '\'). */
export const likeTerm = (term: string) => `%${term.replace(/[\\%_]/g, "\\$&")}%`;

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const cleanName = (value: FormDataEntryValue | null) => String(value ?? "").trim().replace(/\s+/g, " ");
export const validName = (name: string) => name.length >= 2 && name.length <= 100 && !/[\u0000-\u001f\u007f]/.test(name);
export const validEmail = (email: string) => email.length <= 254 && emailPattern.test(email);
