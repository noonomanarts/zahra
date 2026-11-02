"use client";

import { useState, useSyncExternalStore } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Icon } from "@/components/admin/icons";
import { btnSecondaryCls } from "@/components/admin/ui";

const noChanges = () => () => {};

/** The one moment a temporary password is visible. */
export default function Credentials({ email, password, children }: { email: string; password: string; children?: React.ReactNode }) {
  const { t } = useAdminI18n();
  const p = t.people;
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(noChanges, () => window.location.origin, () => "");
  const signIn = `${origin}/admin/login`;
  const copy = async () => {
    await navigator.clipboard.writeText(`${p.signInAddress}: ${signIn}\n${p.email}: ${email}\n${p.temporaryPassword}: ${password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const rows = [[p.signInAddress, signIn], [p.email, email], [p.temporaryPassword, password]];
  return (
    <div role="status" className="zds-rise rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Icon name="key" size={20} /></span>
        <div className="min-w-0">
          <h2 className="font-sans text-base font-semibold text-zinc-900">{p.credentialsTitle}</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600">{p.credentialsText}</p>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-emerald-100 rounded-xl bg-white ring-1 ring-emerald-100">
        {rows.map(([label, value], i) => (
          <div key={label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd dir="ltr" className={`min-w-0 text-sm break-all text-zinc-900 ${i === 2 ? "font-mono font-semibold" : ""}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={btnSecondaryCls}>
          <Icon name={copied ? "check" : "copy"} size={16} /> {copied ? p.copied : p.copy}
        </button>
        {children}
      </div>
    </div>
  );
}
