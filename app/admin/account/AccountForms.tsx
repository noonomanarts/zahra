"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { ConfirmAction } from "@/components/admin/motion";
import { Card, Field, FormMessage, btnCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { changePassword, saveProfile, signOutOthers, type AccountState } from "./actions";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const { t } = useAdminI18n();
  const a = t.account;
  const [state, action, pending] = useActionState<AccountState, FormData>(saveProfile, {});
  return (
    <Card title={a.profile}>
      <form action={action} className="grid gap-4">
        <Field label={a.name}><input name="name" required minLength={2} maxLength={100} defaultValue={name} autoComplete="name" className={inputCls} /></Field>
        <Field label={a.email} hint={a.emailHint}><input name="email" type="email" required dir="ltr" maxLength={254} defaultValue={email} autoComplete="username" className={inputCls} /></Field>
        <Field label={a.confirmPassword} hint={a.confirmPasswordHint}><input name="current" type="password" dir="ltr" autoComplete="current-password" className={inputCls} /></Field>
        <FormMessage state={state} />
        <button disabled={pending} className={`${btnCls} w-fit`}>{pending ? t.common.saving : t.common.save}</button>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const { t } = useAdminI18n();
  const s = t.settings;
  const [state, action, pending] = useActionState<AccountState, FormData>(changePassword, {});
  return (
    <Card title={s.password}>
      <form action={action} className="grid gap-4">
        <Field label={s.current}><input name="current" type="password" dir="ltr" required autoComplete="current-password" className={inputCls} /></Field>
        <Field label={s.next} hint={s.nextHint}><input name="next" type="password" dir="ltr" required minLength={10} maxLength={128} autoComplete="new-password" className={inputCls} /></Field>
        <Field label={s.repeat}><input name="confirm" type="password" dir="ltr" required autoComplete="new-password" className={inputCls} /></Field>
        <FormMessage state={state} />
        <button disabled={pending} className={`${btnCls} w-fit`}>{pending ? t.common.saving : s.change}</button>
      </form>
    </Card>
  );
}

export function SignOutOthers() {
  const { t } = useAdminI18n();
  const a = t.account;
  const [state, action] = useActionState<AccountState>(signOutOthers, {});
  return (
    <div className="space-y-3">
      <FormMessage state={state} />
      <form id="sign-out-others" action={action} className="hidden" />
      <ConfirmAction form="sign-out-others" className={btnSecondaryCls} trigger={a.signOutOthers} title={a.signOutOthersTitle} description={a.signOutOthersText} confirm={a.signOutOthersConfirm} cancel={t.common.cancel} />
    </div>
  );
}
