import Link from "next/link";
import MarkdownEditor from "./MarkdownEditor";
import type { L } from "@/lib/types";

export const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-[0_1px_1px_rgba(0,0,0,0.03)] outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:bg-zinc-50 disabled:text-zinc-400";

export const btnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-zinc-900/10 transition hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:pointer-events-none disabled:opacity-50";

export const btnSecondaryCls =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-[0_1px_1px_rgba(0,0,0,0.03)] transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:pointer-events-none disabled:opacity-50";

export const btnDangerCls =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 hover:bg-red-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-zinc-700">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-zinc-500">{hint}</span>}
    </label>
  );
}

/** Small language badge shown on each half of a bilingual field. */
export function LangTag({ lang }: { lang: "en" | "ar" }) {
  return (
    <span className="pointer-events-none absolute end-2 top-2 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-500 uppercase">
      {lang}
    </span>
  );
}

/**
 * Uncontrolled bilingual field for Server Action forms: posts `<name>_en` and `<name>_ar`.
 * English is always left-to-right and Arabic right-to-left, whatever the panel language.
 */
export function LField({
  label,
  name,
  value,
  hint,
  multiline,
  rows = 3,
  required,
  mono,
}: {
  label: string;
  name: string;
  value?: L;
  hint?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  mono?: boolean;
}) {
  const cls = `${inputCls} pe-10 ${mono ? "font-mono text-xs" : ""}`;
  const input = (lang: "en" | "ar") => {
    const props = {
      name: `${name}_${lang}`,
      defaultValue: value?.[lang] ?? "",
      dir: lang === "ar" ? "rtl" : "ltr",
      lang,
      required: required && lang === "en",
      className: cls,
    } as const;
    if (multiline) return <MarkdownEditor label={`${label} (${lang})`} name={`${name}_${lang}`} defaultValue={value?.[lang] ?? ""} lang={lang} rows={rows} />;
    return (
      <div className="relative">
        <input {...props} />
        <LangTag lang={lang} />
      </div>
    );
  };
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>
      <div className={`grid gap-2 ${multiline ? "lg:grid-cols-2" : "sm:grid-cols-2"}`}>
        {input("en")}
        {input("ar")}
      </div>
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </div>
  );
}

export function Card({ title, description, actions, children, flush }: { title?: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; flush?: boolean }) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,16,16,0.04)]">
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="font-sans text-[15px] font-semibold text-zinc-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function PageTitle({
  title,
  description,
  back,
  backLabel,
  actions,
}: {
  title: string;
  description?: string;
  back?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="zds-rise mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-2 inline-flex items-center gap-1.5 rounded-md text-sm text-zinc-500 transition hover:text-zinc-900">
            <span className="rtl:rotate-180" aria-hidden="true">←</span> {backLabel}
          </Link>
        )}
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[28px] rtl:tracking-normal">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** KPI tile: label, big value (a node, so it can count up) and a hint. */
export function Stat({ label, value, hint, icon, tone = "zinc" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: "zinc" | "emerald" | "amber" | "rose" | "sky" }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    sky: "bg-sky-50 text-sky-600",
  };
  return (
    <div className="group rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,16,16,0.04)] transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-zinc-500">{label}</p>
        {icon && <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>{icon}</span>}
      </div>
      <p className="mt-3 text-[26px] leading-none font-semibold tracking-tight text-zinc-900">{value}</p>
      {hint && <p className="mt-2 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

/** Notice bar (warnings, tips) with an optional action. */
export function Notice({ children, action, tone = "amber" }: { children: React.ReactNode; action?: React.ReactNode; tone?: "amber" | "sky" }) {
  const cls = tone === "amber" ? "border-amber-200/80 bg-amber-50/80 text-amber-900" : "border-sky-200/80 bg-sky-50/80 text-sky-900";
  return (
    <div className={`zds-rise flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${cls}`}>
      <p className="flex items-start gap-2.5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mt-px shrink-0 opacity-70" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
        <span>{children}</span>
      </p>
      {action}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  paid: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  processing: "bg-sky-50 text-sky-800 ring-sky-200",
  shipped: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  completed: "bg-zinc-100 text-zinc-800 ring-zinc-300",
  failed: "bg-red-50 text-red-800 ring-red-200",
  cancelled: "bg-zinc-50 text-zinc-500 ring-zinc-200",
  outOfStock: "bg-zinc-50 text-zinc-500 ring-zinc-200",
  published: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  draft: "bg-zinc-100 text-zinc-600 ring-zinc-300",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
};

export function Badge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {label}
    </span>
  );
}

export function FormMessage({ state }: { state?: { error?: string; ok?: string } }) {
  if (state?.error)
    return (
      <p role="alert" className="zds-rise flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
        {state.error}
      </p>
    );
  if (state?.ok)
    return (
      <p role="status" className="zds-rise flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-100">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true"><path d="M5 12.5 10 17 19 7" /></svg>
        {state.ok}
      </p>
    );
  return null;
}

/** Bilingual values posted by <LField name="x" />. */
export function readL(formData: FormData, name: string): L {
  return { en: String(formData.get(`${name}_en`) ?? "").trim(), ar: String(formData.get(`${name}_ar`) ?? "").trim() };
}
