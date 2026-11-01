"use client";

import { useActionState, useState, useTransition } from "react";
import { sendServiceRequest, type ServiceRequestState } from "@/app/[lang]/service-actions";
import Money from "@/components/Money";
import { useI18n } from "@/components/providers/I18nProvider";
import { whatsappUrl } from "@/lib/whatsapp";
import {
  ChoiceCards,
  FileDrop,
  FormField,
  FormStep,
  RequestSuccess,
  SubmitButton,
  TermsCheckbox,
  focusFirstError,
  inputCls,
  validateForm,
  type Errors,
  without,
} from "./FormKit";
import { useServerErrors } from "./useServerErrors";

type Props = {
  whatsapp: string;
  fabrics: string[];
  hoopSizes: number[];
  fees: { "as-is": number | null; edits: number | null };
  defaults?: { name: string; email: string } | null;
};

export default function PrintDesignForm({ whatsapp, fabrics, hoopSizes, fees, defaults }: Props) {
  const { lang, t } = useI18n();
  const p = t.printDesign;
  const s = t.services;
  const [state, action] = useActionState<ServiceRequestState, FormData>(sendServiceRequest.bind(null, "print-design", lang), {});
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [fabric, setFabric] = useState("");
  const [hoop, setHoop] = useState("");
  const [service, setService] = useState<"" | "as-is" | "edits">("");
  const [pieces, setPieces] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [terms, setTerms] = useState(false);
  const [done, setDone] = useServerErrors(state, setErrors);

  const clear = (name: string) => errors[name] && setErrors((e) => without(e, name));
  const fee = service ? fees[service] : null;
  const feeLabel = (v: number | null) =>
    v === null ? (
      <span className="text-xs text-muted">{p.feeOnRequest}</span>
    ) : (
      <span className="text-sm font-semibold text-brand-dark">
        <Money amount={v} /> <span className="font-normal text-muted">/ {p.perPiece}</span>
      </span>
    );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const found = validateForm(el, s.errors);
    if (!fabric) found.fabric = s.errors.required;
    if (!hoop) found.hoop = s.errors.required;
    if (!service) found.service = s.errors.required;
    if (service && !files.length) found.files = s.errors.required;
    if (errors.files && files.length) found.files = errors.files;
    if (!terms) found.terms = s.errors.terms;
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => focusFirstError(el, found));
      return;
    }
    const data = new FormData(el);
    files.forEach((f) => data.append("files", f));
    startTransition(() => action(data));
  }

  if (done) {
    return (
      <RequestSuccess
        number={done}
        whatsapp={whatsappUrl(whatsapp, t.whatsapp.aboutRequest(done))}
        onReset={() => {
          setDone(null);
          setFiles([]);
          setService("");
          setPieces(1);
          setTerms(false);
          setErrors({});
        }}
      >
        {state.estimate ? (
          <p className="mt-4 text-sm text-muted">
            {p.estimate}: <Money amount={state.estimate} className="font-semibold text-ink" />
          </p>
        ) : null}
      </RequestSuccess>
    );
  }

  const summary: [string, string][] = [
    [p.fabric, fabric ? fabrics[Number(fabric)] : "—"],
    [p.hoop, hoop ? p.hoopValue(Number(hoop)) : "—"],
    [p.serviceType, service === "edits" ? p.edits : service === "as-is" ? p.asIs : "—"],
    [p.pieces, String(pieces)],
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <form onSubmit={onSubmit} noValidate className="min-w-0 space-y-8" aria-busy={pending}>

        <FormStep n={1} title={p.formTitle}>
          <ChoiceCards
            legend={p.fabric}
            name="fabric"
            columns={fabrics.length >= 3 ? 3 : 2}
            value={fabric}
            error={errors.fabric}
            onChange={(v) => {
              setFabric(v);
              clear("fabric");
            }}
            options={fabrics.map((label, i) => ({ value: String(i), label }))}
          />
          <ChoiceCards
            legend={p.hoop}
            name="hoop"
            columns={3}
            hint={p.hoopHint}
            value={hoop}
            error={errors.hoop}
            onChange={(v) => {
              setHoop(v);
              clear("hoop");
            }}
            options={hoopSizes.map((n) => ({ value: String(n), label: p.hoopValue(n) }))}
          />
          <ChoiceCards
            legend={p.serviceType}
            name="service"
            value={service}
            error={errors.service}
            onChange={(v) => {
              setService(v as "as-is" | "edits");
              clear("service");
            }}
            options={[
              { value: "as-is", label: p.asIs, description: p.asIsText, aside: feeLabel(fees["as-is"]) },
              { value: "edits", label: p.edits, description: p.editsText, aside: feeLabel(fees.edits) },
            ]}
          />
        </FormStep>

        {service ? (
          <div key={service} className="zds-rise">
            <FormStep n={2} title={service === "edits" ? p.edits : p.asIs}>
              <FileDrop
                label={p.file}
                hint={`${p.fileHint} ${s.uploadTypes}`}
                required
                inputName="files"
                files={files}
                error={errors.files}
                onChange={(next, problem) => {
                  setFiles(next);
                  setErrors((e) => (problem ? { ...without(e, "files"), files: problem } : without(e, "files")));
                }}
              />
              {service === "edits" && (
                <FormField label={p.changes} name="changes" error={errors.changes}>
                  {(f) => <textarea {...f} required rows={4} maxLength={1500} placeholder={p.changesPlaceholder} onInput={() => clear("changes")} className={inputCls} />}
                </FormField>
              )}
              <FormField label={p.pieces} name="pieces" error={errors.pieces}>
                {(f) => (
                  <div className="inline-flex items-center rounded-full border border-line bg-white" dir="ltr">
                    <button type="button" onClick={() => setPieces((n) => Math.max(1, n - 1))} disabled={pieces <= 1} aria-label={t.product.decrease} className="grid h-12 w-12 place-items-center rounded-full text-lg transition hover:bg-brand-soft disabled:opacity-30">−</button>
                    <input
                      {...f}
                      type="number"
                      min={1}
                      max={50}
                      required
                      value={pieces}
                      onChange={(e) => setPieces(Math.min(50, Math.max(1, Math.floor(Number(e.target.value)) || 1)))}
                      className="h-12 w-14 bg-transparent text-center font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button type="button" onClick={() => setPieces((n) => Math.min(50, n + 1))} disabled={pieces >= 50} aria-label={t.product.increase} className="grid h-12 w-12 place-items-center rounded-full text-lg transition hover:bg-brand-soft disabled:opacity-30">+</button>
                  </div>
                )}
              </FormField>
              <FormField label={p.notes} name="notes" optional>
                {(f) => <textarea {...f} rows={3} maxLength={1000} placeholder={p.notesPlaceholder} className={inputCls} />}
              </FormField>
            </FormStep>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-5 py-4 text-sm text-muted">{p.chooseService}</p>
        )}

        <FormStep n={service ? 3 : 2} title={s.contact}>
          <FormField label={s.name} name="name" error={errors.name}>
            {(f) => <input {...f} required maxLength={100} autoComplete="name" defaultValue={defaults?.name} onInput={() => clear("name")} className={inputCls} />}
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label={s.email} name="email" error={errors.email}>
              {(f) => <input {...f} type="email" required maxLength={254} dir="ltr" autoComplete="email" defaultValue={defaults?.email} onInput={() => clear("email")} className={`${inputCls} rtl:text-right`} />}
            </FormField>
            <FormField label={s.phone} name="phone" hint={s.phoneHint} error={errors.phone}>
              {(f) => <input {...f} type="tel" required minLength={7} maxLength={30} dir="ltr" autoComplete="tel" inputMode="tel" onInput={() => clear("phone")} className={`${inputCls} rtl:text-right`} />}
            </FormField>
          </div>
        </FormStep>

        <div className="space-y-5 border-t border-line pt-8">
          <TermsCheckbox
            checked={terms}
            error={errors.terms}
            onChange={(v) => {
              setTerms(v);
              clear("terms");
            }}
          />
          {errors._form && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errors._form}</p>}
          <SubmitButton pending={pending} />
          {/* honeypot: invisible to people, filled in by bots */}
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        </div>
      </form>

      <aside className="h-fit rounded-3xl bg-brand-soft p-6 lg:sticky lg:top-40">
        <h3 className="font-sans text-lg font-semibold">{p.summary}</h3>
        <dl className="mt-4 space-y-3 text-sm">
          {summary.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-muted">{k}</dt>
              <dd className="text-end font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 border-t border-brand/15 pt-4" aria-live="polite">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-semibold">{p.estimate}</span>
            {fee !== null ? (
              <Money amount={Math.round(fee * pieces * 1000) / 1000} className="text-xl font-bold text-brand-dark" />
            ) : (
              <span className="text-end text-sm text-muted">{service ? p.feeOnRequest : "—"}</span>
            )}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">{p.estimateNote}</p>
        </div>
      </aside>
    </div>
  );
}
