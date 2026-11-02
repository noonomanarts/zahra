"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Icon } from "@/components/admin/icons";
import { ToggleField } from "@/components/admin/motion";
import { Card, Field, FormMessage, btnCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { saveEmailSettings, sendTestEmail, type EmailState } from "./actions";

export type EmailView = {
  enabled: boolean;
  host: string;
  port: number;
  security: string;
  username: string;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  adminEmails: string;
  customerEmails: boolean;
  adminAlerts: boolean;
};

export function EmailSettingsForm({ view }: { view: EmailView }) {
  const { t } = useAdminI18n();
  const e = t.email;
  const [state, action, pending] = useActionState<EmailState, FormData>(saveEmailSettings, {});
  return (
    <form action={action} className="space-y-6">
      <Card title={e.status}>
        <div className="space-y-4">
          <ToggleField name="enabled" label={e.enabled} description={e.enabledHint} defaultChecked={view.enabled} />
          <ToggleField name="customerEmails" label={e.customerEmails} description={e.customerEmailsHint} defaultChecked={view.customerEmails} />
          <ToggleField name="adminAlerts" label={e.adminAlerts} description={e.adminAlertsHint} defaultChecked={view.adminAlerts} />
        </div>
      </Card>
      <Card title={e.smtp} description={e.smtpHint}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={e.host}><input name="host" dir="ltr" autoComplete="off" placeholder="smtp.example.com" defaultValue={view.host} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={e.port}><input name="port" type="number" dir="ltr" min="1" max="65535" required defaultValue={view.port} className={inputCls} /></Field>
            <Field label={e.security}>
              <select key={String(view.security)} name="security" defaultValue={view.security} className={inputCls}>
                <option value="starttls">STARTTLS</option>
                <option value="tls">SSL/TLS</option>
                <option value="none">{e.noEncryption}</option>
              </select>
            </Field>
          </div>
          <Field label={e.username}><input name="username" dir="ltr" autoComplete="off" defaultValue={view.username} className={inputCls} /></Field>
          <Field label={e.password} hint={view.hasPassword ? e.passwordSaved : e.passwordMissing}><input name="password" type="password" dir="ltr" autoComplete="new-password" placeholder={view.hasPassword ? "••••••••" : ""} className={inputCls} /></Field>
        </div>
      </Card>
      <Card title={e.addresses}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={e.fromName}><input name="fromName" maxLength={100} defaultValue={view.fromName} className={inputCls} /></Field>
          <Field label={e.fromEmail} hint={e.fromEmailHint}><input name="fromEmail" type="email" dir="ltr" defaultValue={view.fromEmail} className={inputCls} /></Field>
          <Field label={e.replyTo} hint={e.optional}><input name="replyTo" type="email" dir="ltr" defaultValue={view.replyTo} className={inputCls} /></Field>
          <Field label={e.adminEmails} hint={e.adminEmailsHint}><input name="adminEmails" dir="ltr" defaultValue={view.adminEmails} className={inputCls} /></Field>
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={btnCls}>{pending ? t.common.saving : t.common.save}</button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function TestEmailForm({ to }: { to: string }) {
  const { t } = useAdminI18n();
  const e = t.email;
  const [state, action, pending] = useActionState<EmailState, FormData>(sendTestEmail, {});
  return (
    <Card title={e.testTitle} description={e.testHint}>
      <form action={action} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input name="to" type="email" required dir="ltr" aria-label={e.testTitle} defaultValue={to} className={`${inputCls} max-w-sm`} />
          <button disabled={pending} className={btnSecondaryCls}><Icon name="mail" size={16} /> {pending ? e.testSending : e.testSend}</button>
        </div>
        <FormMessage state={state} />
      </form>
    </Card>
  );
}
