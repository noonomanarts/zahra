"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import type { AccountFormState } from "../../account-actions";

const input = "w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";
const label = "mb-2 block text-sm font-medium";
const submit = "min-h-12 rounded-full bg-brand-dark px-7 font-medium text-white transition hover:bg-ink disabled:cursor-wait disabled:opacity-60";
type Action = (previous: AccountFormState, formData: FormData) => Promise<AccountFormState>;

function Message({ state, saved }: { state: AccountFormState; saved: string }) {
  const { t } = useI18n();
  if (state.error) return <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t.auth.errors[state.error]}</p>;
  if (state.saved) return <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{saved}</p>;
  return null;
}

export function DetailsForm({ name, email, action }: { name: string; email: string; action: Action }) {
  const { t } = useI18n();
  const a = t.account;
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-5">
      <div><label htmlFor="profile-name" className={label}>{t.auth.name}</label><input id="profile-name" name="name" required minLength={2} maxLength={100} autoComplete="name" defaultValue={name} className={input} /></div>
      <div><label htmlFor="profile-email" className={label}>{t.auth.email}</label><input id="profile-email" name="email" type="email" required maxLength={254} dir="ltr" autoComplete="email" defaultValue={email} className={`${input} rtl:text-right`} /></div>
      <div>
        <label htmlFor="profile-current" className={label}>{a.currentPassword}</label>
        <input id="profile-current" name="current" type="password" maxLength={128} dir="ltr" autoComplete="current-password" className={`${input} rtl:text-right`} />
        <p className="mt-2 text-xs text-muted">{a.currentPasswordHint}</p>
      </div>
      <Message state={state} saved={a.detailsSaved} />
      <button disabled={pending} className={submit}>{pending ? a.saving : a.saveDetails}</button>
    </form>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const { t } = useI18n();
  const a = t.account;
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-5">
      <div><label htmlFor="password-current" className={label}>{a.currentPassword}</label><input id="password-current" name="current" type="password" required maxLength={128} dir="ltr" autoComplete="current-password" className={`${input} rtl:text-right`} /></div>
      <NewPasswordFields />
      <Message state={state} saved={a.passwordChanged} />
      <button disabled={pending} className={submit}>{pending ? a.saving : a.savePassword}</button>
    </form>
  );
}

export function NewPasswordFields() {
  const { t } = useI18n();
  return (
    <>
      <div>
        <label htmlFor="password-next" className={label}>{t.auth.newPassword}</label>
        <input id="password-next" name="next" type="password" required minLength={8} maxLength={128} dir="ltr" autoComplete="new-password" className={`${input} rtl:text-right`} />
        <p className="mt-2 text-xs text-muted">{t.auth.passwordHint}</p>
      </div>
      <div><label htmlFor="password-confirm" className={label}>{t.auth.confirmPassword}</label><input id="password-confirm" name="confirm" type="password" required minLength={8} maxLength={128} dir="ltr" autoComplete="new-password" className={`${input} rtl:text-right`} /></div>
    </>
  );
}

export function ResetForm({ token, action }: { token: string; action: Action }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <NewPasswordFields />
      <Message state={state} saved="" />
      <button disabled={pending} className={`${submit} w-full`}>{pending ? t.account.saving : t.auth.saveNewPassword}</button>
    </form>
  );
}

export function ForgotForm({ action }: { action: Action }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, {});
  if (state.saved) return <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{t.auth.forgotSent}</p>;
  return (
    <form action={formAction} className="space-y-5">
      <div><label htmlFor="forgot-email" className={label}>{t.auth.email}</label><input id="forgot-email" name="email" type="email" required maxLength={254} dir="ltr" autoComplete="email" className={`${input} rtl:text-right`} /></div>
      <Message state={state} saved="" />
      <button disabled={pending} className={`${submit} w-full`}>{pending ? t.account.saving : t.auth.forgotSend}</button>
    </form>
  );
}
