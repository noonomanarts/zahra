"use client";

import { useActionState, useState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Icon } from "@/components/admin/icons";
import { ConfirmAction } from "@/components/admin/motion";
import { Field, FormMessage, btnCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { manageCustomer, saveCustomer, type CustomerState } from "./actions";

export function CustomerProfile({ id, name, email, locked }: { id: number; name: string; email: string; locked: boolean }) {
  const { t } = useAdminI18n();
  const c = t.customers;
  const [state, action, pending] = useActionState<CustomerState, FormData>(saveCustomer, {});
  return (
    <form action={action}>
      <fieldset disabled={locked} className="m-0 grid min-w-0 gap-4 border-0 p-0">
        <input type="hidden" name="id" value={id} />
        <Field label={c.name}><input name="name" required minLength={2} maxLength={100} defaultValue={name} autoComplete="off" className={inputCls} /></Field>
        <Field label={c.email} hint={locked ? undefined : c.emailHint}><input name="email" type="email" required dir="ltr" maxLength={254} defaultValue={email} autoComplete="off" className={inputCls} /></Field>
        {!locked && (
          <>
            <FormMessage state={state} />
            <button disabled={pending} className={`${btnCls} w-fit`}>{pending ? t.common.saving : t.common.save}</button>
          </>
        )}
      </fieldset>
    </form>
  );
}

function ResetLink({ link, whatsapp }: { link: string; whatsapp: string | null }) {
  const { t } = useAdminI18n();
  const c = t.customers;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
      <p className="text-zinc-700">{c.resetLinkHint}</p>
      <p data-reset-link dir="ltr" className="mt-2 rounded-lg bg-white p-2 font-mono text-xs break-all text-zinc-900 ring-1 ring-emerald-100">{link}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={`${btnSecondaryCls} px-3 py-1.5 text-xs`}><Icon name={copied ? "check" : "copy"} size={14} /> {copied ? t.people.copied : t.people.copy}</button>
        {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={`${btnSecondaryCls} px-3 py-1.5 text-xs`}><Icon name="requests" size={14} /> {c.sendWhatsapp}</a>}
      </div>
    </div>
  );
}

const row = `${btnSecondaryCls} w-full justify-start`;
const danger = "inline-flex w-full items-center justify-start gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600";

export function CustomerActions({ id, name, suspended }: { id: number; name: string; suspended: boolean }) {
  const { t } = useAdminI18n();
  const c = t.customers;
  const [state, action, pending] = useActionState<CustomerState, FormData>(manageCustomer, {});
  const op = (o: string) => (
    <form id={`customer-${o}`} action={action} className="hidden">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={o} />
    </form>
  );
  const cancel = t.common.cancel;
  return (
    <div className="space-y-2">
      <FormMessage state={state} />
      {state.resetLink && <ResetLink link={state.resetLink} whatsapp={state.whatsapp ?? null} />}
      {op("resetLink")}
      {op("revoke")}
      {op("suspend")}
      {op("reactivate")}
      {op("delete")}
      {!suspended && <button form="customer-resetLink" disabled={pending} className={row}><Icon name="key" size={16} /> {c.resetLink}</button>}
      <ConfirmAction cancel={cancel} form="customer-revoke" className={row} trigger={<><Icon name="logout" size={16} className="rtl:-scale-x-100" /> {c.revoke}</>} title={c.revokeTitle} description={c.revokeText(name)} confirm={c.revokeConfirm} />
      {suspended ? (
        <button form="customer-reactivate" disabled={pending} className={row}><Icon name="check" size={16} /> {c.reactivate}</button>
      ) : (
        <ConfirmAction cancel={cancel} form="customer-suspend" className={danger} trigger={<><Icon name="ban" size={16} /> {c.suspend}</>} title={c.suspendTitle} description={c.suspendText(name)} confirm={c.suspendConfirm} />
      )}
      <ConfirmAction cancel={cancel} form="customer-delete" className={danger} trigger={<><Icon name="trash" size={16} /> {c.delete}</>} title={c.deleteTitle} description={c.deleteText(name)} confirm={c.deleteConfirm} />
    </div>
  );
}
