"use client";

import { useActionState, useState, useTransition } from "react";
import { sendServiceRequest, type ServiceRequestState } from "@/app/[lang]/service-actions";
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

const AIDA = ["11", "14", "16", "18"];

export default function CustomPatternForm({ whatsapp, defaults }: { whatsapp: string; defaults?: { name: string; email: string } | null }) {
  const { lang, t } = useI18n();
  const c = t.customPattern;
  const s = t.services;
  const [state, action] = useActionState<ServiceRequestState, FormData>(sendServiceRequest.bind(null, "custom-pattern", lang), {});
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [files, setFiles] = useState<File[]>([]);
  const [aida, setAida] = useState("14");
  const [kit, setKit] = useState("");
  const [terms, setTerms] = useState(false);
  const [done, setDone] = useServerErrors(state, setErrors);

  const clear = (name: string) => errors[name] && setErrors((e) => without(e, name));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const found = validateForm(el, s.errors);
    if (!kit) found.fullKit = s.errors.required;
    if (errors.files) found.files = errors.files;
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
          setKit("");
          setTerms(false);
          setErrors({});
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8" aria-busy={pending}>

      <FormStep n={1} title={s.contact}>
        <FormField label={s.name} name="name" error={errors.name}>
          {(p) => <input {...p} required maxLength={100} autoComplete="name" defaultValue={defaults?.name} onInput={() => clear("name")} className={inputCls} />}
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label={s.email} name="email" error={errors.email}>
            {(p) => <input {...p} type="email" required maxLength={254} dir="ltr" autoComplete="email" defaultValue={defaults?.email} onInput={() => clear("email")} className={`${inputCls} rtl:text-right`} />}
          </FormField>
          <FormField label={s.phone} name="phone" hint={s.phoneHint} error={errors.phone}>
            {(p) => <input {...p} type="tel" required minLength={7} maxLength={30} dir="ltr" autoComplete="tel" inputMode="tel" onInput={() => clear("phone")} className={`${inputCls} rtl:text-right`} />}
          </FormField>
        </div>
      </FormStep>

      <FormStep n={2} title={c.pattern}>
        <div>
          <ChoiceCards
            legend={c.aidaCount}
            name="aidaChoice"
            columns={5}
            hint={c.aidaHint}
            value={aida}
            onChange={(v) => {
              setAida(v);
              clear("aidaCount");
            }}
            options={[...AIDA.map((n) => ({ value: n, label: n })), { value: "other", label: c.aidaOther }]}
          />
          {aida === "other" ? (
            <FormField label={c.aidaOtherLabel} name="aidaCount" error={errors.aidaCount} className="zds-rise mt-4">
              {(p) => <input {...p} required maxLength={20} dir="ltr" inputMode="numeric" onInput={() => clear("aidaCount")} className={`${inputCls} max-w-48 rtl:text-right`} />}
            </FormField>
          ) : (
            <input type="hidden" name="aidaCount" value={aida} />
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label={c.dimensions} name="dimensions" error={errors.dimensions}>
            {(p) => <input {...p} required maxLength={100} placeholder={c.dimensionsPlaceholder} onInput={() => clear("dimensions")} className={inputCls} />}
          </FormField>
          <FormField label={c.colours} name="colours" error={errors.colours}>
            {(p) => <input {...p} required maxLength={300} placeholder={c.coloursPlaceholder} onInput={() => clear("colours")} className={inputCls} />}
          </FormField>
        </div>
        <FormField label={c.description} name="description" error={errors.description}>
          {(p) => <textarea {...p} required rows={5} maxLength={2000} placeholder={c.descriptionPlaceholder} onInput={() => clear("description")} className={inputCls} />}
        </FormField>
        <FileDrop
          label={c.reference}
          hint={`${c.referenceHint} ${s.uploadTypes}`}
          inputName="files"
          files={files}
          error={errors.files}
          onChange={(next, problem) => {
            setFiles(next);
            setErrors((e) => (problem ? { ...without(e, "files"), files: problem } : without(e, "files")));
          }}
        />
      </FormStep>

      <FormStep n={3} title={c.kitStep}>
        <ChoiceCards
          legend={c.kitQuestion}
          name="fullKit"
          value={kit}
          error={errors.fullKit}
          onChange={(v) => {
            setKit(v);
            clear("fullKit");
          }}
          options={[
            { value: "yes", label: c.yes, description: c.kitHint },
            { value: "no", label: c.no },
          ]}
        />
        {kit === "yes" && (
          <fieldset className="zds-rise space-y-5 rounded-2xl bg-brand-soft/40 p-5">
            <legend className="mb-1 text-sm font-semibold">{c.address}</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label={c.country} name="country" error={errors.country}>
                {(p) => <input {...p} required maxLength={100} autoComplete="country-name" defaultValue={t.checkout.defaultCountry} onInput={() => clear("country")} className={inputCls} />}
              </FormField>
              <FormField label={c.city} name="city" error={errors.city}>
                {(p) => <input {...p} required maxLength={100} autoComplete="address-level2" onInput={() => clear("city")} className={inputCls} />}
              </FormField>
            </div>
            <FormField label={c.street} name="address" error={errors.address}>
              {(p) => <textarea {...p} required rows={2} maxLength={500} autoComplete="street-address" onInput={() => clear("address")} className={inputCls} />}
            </FormField>
          </fieldset>
        )}
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
  );
}
