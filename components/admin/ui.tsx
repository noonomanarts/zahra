import Link from "next/link";
import type { L } from "@/lib/types";

export const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-zinc-50";

export const btnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50";

export const btnSecondaryCls =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50";

export const btnDangerCls =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
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
    return (
      <div className="relative">
        {multiline ? <textarea rows={rows} {...props} /> : <input {...props} />}
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

export function Card({ title, actions, children }: { title?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-3.5">
          {title && <h2 className="font-sans text-sm font-semibold text-zinc-900">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageTitle({ title, back, backLabel, actions }: { title: string; back?: string; backLabel?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        {back && (
          <Link href={back} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
            <span className="rtl:rotate-180" aria-hidden="true">←</span> {backLabel}
          </Link>
        )}
        <h1 className="font-sans text-2xl font-semibold text-zinc-900">{title}</h1>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
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
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}>
      {label}
    </span>
  );
}

export function FormMessage({ state }: { state?: { error?: string; ok?: string } }) {
  if (state?.error) return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state?.ok) return <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>;
  return null;
}

/** Bilingual values posted by <LField name="x" />. */
export function readL(formData: FormData, name: string): L {
  return { en: String(formData.get(`${name}_en`) ?? "").trim(), ar: String(formData.get(`${name}_ar`) ?? "").trim() };
}
