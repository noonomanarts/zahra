"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Icon } from "@/components/admin/icons";
import { Card, Field, FormMessage, btnCls, inputCls } from "@/components/admin/ui";
import { savePayments, type PaymentState } from "./actions";

export type PaymentView = {
  active: "paymob" | "amwalpay" | "none";
  paymob: { publicKey: string; integrationIds: string; apiUrl: string; checkoutUrl: string; hasSecret: boolean; hasHmac: boolean; ready: boolean; fromEnv: boolean };
  amwalpay: { environment: string; merchantId: string; terminalId: string; hasSecret: boolean; ready: boolean };
  urls: { paymobWebhook: string; amwalWebhook: string };
};

function Copyable({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[13px] font-medium text-zinc-700">{label}</p>
      <code dir="ltr" className="block rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs break-all text-zinc-800 ring-1 ring-zinc-200">{value}</code>
    </div>
  );
}

export default function PaymentForm({ view }: { view: PaymentView }) {
  const { t } = useAdminI18n();
  const p = t.payments;
  const [state, action, pending] = useActionState<PaymentState, FormData>(savePayments, {});
  const secretHint = (saved: boolean) => (saved ? p.secretSaved : p.secretMissing);
  const options = [
    { value: "paymob" as const, title: "Paymob", text: p.paymobInfo, ready: view.paymob.ready },
    { value: "amwalpay" as const, title: "AmwalPay", text: p.amwalInfo, ready: view.amwalpay.ready },
    { value: "none" as const, title: p.noneTitle, text: p.noneInfo, ready: true },
  ];

  return (
    <form action={action} className="space-y-6">
      <Card title={p.activeTitle} description={p.activeHint}>
        <fieldset className="grid gap-3 md:grid-cols-3">
          <legend className="sr-only">{p.activeTitle}</legend>
          {options.map((o) => (
            <label key={o.value} className="relative block cursor-pointer">
              {/* uncontrolled: a form resets to its defaults after saving, and the default must be what was saved */}
              <input type="radio" name="active" value={o.value} defaultChecked={view.active === o.value} className="peer sr-only" />
              <span className="block h-full rounded-xl border border-zinc-200 bg-white p-4 transition peer-checked:border-zinc-900 peer-checked:ring-1 peer-checked:ring-zinc-900 peer-focus-visible:ring-2 peer-focus-visible:ring-brand hover:border-zinc-300">
                <span className="block pe-6 text-sm font-semibold text-zinc-900">{o.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{o.text}</span>
                {o.value !== "none" && <span className={`mt-2 block text-xs font-medium ${o.ready ? "text-emerald-700" : "text-amber-700"}`}>{o.ready ? p.ready : p.notReady}</span>}
              </span>
              <span className="absolute end-3 top-4 hidden size-5 place-items-center rounded-full bg-zinc-900 text-white peer-checked:grid" aria-hidden="true"><Icon name="check" size={12} strokeWidth={3} /></span>
            </label>
          ))}
        </fieldset>
      </Card>

      <Card title="AmwalPay" description={p.amwalHint}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={p.environment} hint={p.environmentHint}>
            <select name="amwal_environment" defaultValue={view.amwalpay.environment} className={inputCls}>
              <option value="prod">{p.environments.prod}</option>
              <option value="uat">{p.environments.uat}</option>
              <option value="sit">{p.environments.sit}</option>
            </select>
          </Field>
          <Field label={p.merchantId}><input name="amwal_merchantId" dir="ltr" autoComplete="off" defaultValue={view.amwalpay.merchantId} className={inputCls} /></Field>
          <Field label={p.terminalId}><input name="amwal_terminalId" dir="ltr" autoComplete="off" defaultValue={view.amwalpay.terminalId} className={inputCls} /></Field>
          <Field label={p.amwalSecret} hint={secretHint(view.amwalpay.hasSecret)}><input name="amwal_secretKey" type="password" dir="ltr" autoComplete="new-password" placeholder={view.amwalpay.hasSecret ? "••••••••" : ""} className={inputCls} /></Field>
        </div>
        <div className="mt-4"><Copyable label={p.amwalWebhook} value={view.urls.amwalWebhook} /></div>
      </Card>

      <Card title="Paymob" description={view.paymob.fromEnv ? p.paymobEnvHint : p.paymobHint}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={p.publicKey}><input name="paymob_publicKey" dir="ltr" autoComplete="off" defaultValue={view.paymob.publicKey} className={inputCls} /></Field>
          <Field label={p.secretKey} hint={secretHint(view.paymob.hasSecret)}><input name="paymob_secretKey" type="password" dir="ltr" autoComplete="new-password" placeholder={view.paymob.hasSecret ? "••••••••" : ""} className={inputCls} /></Field>
          <Field label={p.hmacSecret} hint={secretHint(view.paymob.hasHmac)}><input name="paymob_hmacSecret" type="password" dir="ltr" autoComplete="new-password" placeholder={view.paymob.hasHmac ? "••••••••" : ""} className={inputCls} /></Field>
          <Field label={p.integrationIds} hint={p.integrationIdsHint}><input name="paymob_integrationIds" dir="ltr" autoComplete="off" defaultValue={view.paymob.integrationIds} className={inputCls} /></Field>
          <Field label={p.apiUrl} hint={p.optional}><input name="paymob_apiUrl" type="url" dir="ltr" defaultValue={view.paymob.apiUrl} placeholder="https://oman.paymob.com" className={inputCls} /></Field>
          <Field label={p.checkoutUrl} hint={p.optional}><input name="paymob_checkoutUrl" type="url" dir="ltr" defaultValue={view.paymob.checkoutUrl} placeholder="https://om.checkout.paymob.com" className={inputCls} /></Field>
        </div>
        <div className="mt-4"><Copyable label={p.paymobWebhook} value={view.urls.paymobWebhook} /></div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={btnCls}>{pending ? t.common.saving : t.common.save}</button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
