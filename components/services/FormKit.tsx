"use client";

/* eslint-disable @next/next/no-img-element -- local previews of files chosen by the visitor (object URLs) */
import { useEffect, useId, useRef, useState } from "react";
import { WhatsAppIcon } from "@/components/shop/Collections";
import { useI18n } from "@/components/providers/I18nProvider";

export const inputCls =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/10 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-100";

export type Errors = Record<string, string>;

/** The errors without one field. */
export const without = (errors: Errors, field: string): Errors => Object.fromEntries(Object.entries(errors).filter(([k]) => k !== field));

/** Label + control + hint/error, wired up with ids for screen readers. */
export function FormField({
  label,
  name,
  hint,
  error,
  optional,
  children,
  className = "",
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (props: { id: string; name: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const describedBy = [hint && !error && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 flex items-baseline justify-between gap-2 text-sm font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-muted">{t.services.optional}</span>}
      </label>
      {children({ id, name, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-700">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      {children}
    </p>
  );
}

/** Radio group shown as selectable cards. `name` is posted with the chosen value. */
export function ChoiceCards({
  legend,
  name,
  options,
  value,
  onChange,
  error,
  hint,
  columns = 2,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string; description?: React.ReactNode; aside?: React.ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  columns?: 2 | 3 | 4 | 5;
}) {
  const id = useId();
  const grid = { 2: "sm:grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4", 5: "grid-cols-3 sm:grid-cols-5" }[columns];
  return (
    <fieldset aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className={`grid gap-2.5 ${grid}`}>
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={`relative flex cursor-pointer gap-3 rounded-2xl border bg-white p-4 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/25 ${
                checked ? "border-brand-dark bg-brand-soft/50 shadow-sm" : error ? "border-red-300" : "border-line hover:border-brand/50"
              }`}
            >
              <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
              <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${checked ? "border-brand-dark" : "border-muted/40"}`}>
                <span className={`h-2.5 w-2.5 rounded-full bg-brand-dark transition ${checked ? "scale-100" : "scale-0"}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-medium">{o.label}</span>
                  {o.aside}
                </span>
                {o.description && <span className="mt-1 block text-sm leading-relaxed text-muted">{o.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </fieldset>
  );
}

const ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.avif,.heic,.heif,.pdf,.svg,image/*,application/pdf";
const ALLOWED = /\.(jpe?g|png|webp|gif|avif|heic|heif|pdf|svg)$/i;
export const FILE_LIMITS = { files: 5, fileBytes: 10 * 1024 * 1024, totalBytes: 25 * 1024 * 1024 };

const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** Drag-and-drop file picker with previews. Files live in state and are added to the FormData on submit. */
export function FileDrop({
  label,
  hint,
  files,
  onChange,
  error,
  required,
  inputName,
}: {
  label: string;
  hint?: string;
  files: File[];
  onChange: (files: File[], error?: string) => void;
  error?: string;
  required?: boolean;
  /** name used to focus the picker when it has an error */
  inputName: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => (/^image\/(jpeg|png|webp|gif|avif)$/.test(f.type) ? URL.createObjectURL(f) : ""));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URLs are created and revoked together with the file list
    setPreviews(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [files]);

  function add(list: FileList | null) {
    if (!list?.length) return;
    const next = [...files];
    let problem: string | undefined;
    for (const f of Array.from(list)) {
      if (!ALLOWED.test(f.name)) problem = t.services.errors.fileType;
      else if (f.size > FILE_LIMITS.fileBytes) problem = t.services.errors.fileSize;
      else if (next.length >= FILE_LIMITS.files) problem = t.services.errors.tooMany;
      else if (next.reduce((n, x) => n + x.size, 0) + f.size > FILE_LIMITS.totalBytes) problem = t.services.errors.fileSize;
      else if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    onChange(next, problem);
  }

  return (
    <div>
      <p id={`${id}-label`} className="mb-2 text-sm font-medium">
        {label}
        {!required && <span className="ms-2 text-xs font-normal text-muted">{t.services.optional}</span>}
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={`relative rounded-2xl border-2 border-dashed px-5 py-7 text-center transition ${
          over ? "border-brand bg-brand-soft/70" : error ? "border-red-300 bg-red-50/40" : "border-brand/30 bg-brand-soft/30 hover:border-brand/60"
        }`}
      >
        <svg className="mx-auto text-brand-dark" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        <button
          type="button"
          name={inputName}
          onClick={() => input.current?.click()}
          aria-labelledby={`${id}-label ${id}-cta`}
          aria-describedby={error ? `${id}-error` : `${id}-types`}
          className="mt-2 text-sm font-medium text-brand-dark underline-offset-4 after:absolute after:inset-0 after:rounded-2xl hover:underline focus-visible:outline-none focus-visible:after:ring-4 focus-visible:after:ring-brand/25"
        >
          <span id={`${id}-cta`}>{t.services.uploadDrop}</span>
        </button>
        <p id={`${id}-types`} className="mt-1 text-xs text-muted">{hint ?? t.services.uploadTypes}</p>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      {files.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {files.map((f, i) => (
            <li key={f.name + f.size} className="flex items-center gap-3 rounded-xl border border-line bg-white p-2 pe-3">
              {previews[i] ? (
                <img src={previews[i]} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-soft text-[11px] font-semibold text-brand-dark uppercase">
                  {f.name.split(".").pop()?.slice(0, 4)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm" dir="auto">{f.name}</span>
                <span className="block text-xs text-muted" dir="ltr">{formatSize(f.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={t.services.removeFile(f.name)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-700"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Numbered step inside a long form. */
export function FormStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className={n > 1 ? "border-t border-line pt-8" : ""}>
      <h3 className="mb-5 flex items-center gap-3 font-sans text-lg font-semibold">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-dark text-sm text-white" aria-hidden="true">{n}</span>
        {title}
      </h3>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function TermsCheckbox({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: string }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
        <input
          type="checkbox"
          name="terms"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand-dark"
        />
        <span>
          {t.services.acceptTerms}{" "}
          <a href="#terms" className="font-medium text-brand-dark underline underline-offset-4">{t.services.termsLink}</a>
        </span>
      </label>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

export function SubmitButton({ pending }: { pending: boolean }) {
  const { t } = useI18n();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-dark px-10 font-medium text-white transition hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {pending ? t.services.sending : t.services.submit}
    </button>
  );
}

/** Replaces the form once the request is stored. */
export function RequestSuccess({ number, whatsapp, onReset, children }: { number: string; whatsapp: string | null; onReset: () => void; children?: React.ReactNode }) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);
  return (
    <div className="zds-rise py-6 text-center sm:py-10" role="status">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-dark text-white shadow-lg">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5 10 17 19 7" /></svg>
      </span>
      <h3 ref={heading} tabIndex={-1} className="mt-6 text-3xl font-bold outline-none">{t.services.successTitle}</h3>
      <p className="mx-auto mt-3 max-w-md text-muted">{t.services.successText(number)}</p>
      <p className="mt-4 inline-block rounded-full bg-white px-5 py-2 font-mono text-lg font-semibold tracking-wider text-brand-dark shadow-sm" dir="ltr">{number}</p>
      {children}
      <div className="mt-8 flex flex-col items-center gap-3">
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-whatsapp px-6 text-white transition-colors hover:bg-whatsapp-dark">
            <WhatsAppIcon /> {t.services.successWhatsApp}
          </a>
        )}
        <button type="button" onClick={onReset} className="min-h-10 text-sm text-muted underline underline-offset-4 hover:text-ink">{t.services.another}</button>
      </div>
    </div>
  );
}

/**
 * Checks required/email/number fields with the browser's constraint API and returns translated messages,
 * so every error is shown next to its field in the site's own style.
 */
export function validateForm(form: HTMLFormElement, messages: { required: string; email: string }): Errors {
  const errors: Errors = {};
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) || !el.name || el.disabled) continue;
    if (el instanceof HTMLInputElement && ["radio", "checkbox", "file", "hidden"].includes(el.type)) continue;
    if (el.validity.valueMissing || (el.required && el.value.trim() === "")) errors[el.name] ??= messages.required;
    else if (el.validity.typeMismatch) errors[el.name] ??= messages.email;
    else if (!el.validity.valid) errors[el.name] ??= messages.required;
  }
  return errors;
}

/** Moves focus to the first field (in page order) that has an error. */
export function focusFirstError(form: HTMLFormElement, errors: Errors) {
  const first = Array.from(form.querySelectorAll<HTMLElement>("[name]")).find((el) => errors[el.getAttribute("name")!]);
  first?.scrollIntoView({ block: "center", behavior: "smooth" });
  first?.focus({ preventScroll: true });
}
