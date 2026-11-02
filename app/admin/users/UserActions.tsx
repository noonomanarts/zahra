"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Icon } from "@/components/admin/icons";
import { ConfirmAction } from "@/components/admin/motion";
import { FormMessage, btnSecondaryCls } from "@/components/admin/ui";
import Credentials from "./Credentials";
import { manageUser, type UserFormState } from "./actions";

const row = `${btnSecondaryCls} w-full justify-start`;
const danger = "inline-flex w-full items-center justify-start gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600";

export default function UserActions({ id, name, active }: { id: number; name: string; active: boolean }) {
  const { t } = useAdminI18n();
  const p = t.people;
  const [state, action, pending] = useActionState<UserFormState, FormData>(manageUser, {});
  const op = (o: string) => (
    <form id={`user-${o}`} action={action} className="hidden">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={o} />
    </form>
  );
  const cancel = t.common.cancel;

  return (
    <div className="space-y-2">
      {state.credentials && <Credentials email={state.credentials.email} password={state.credentials.password} />}
      <FormMessage state={state} />
      {op("reset")}
      {op("revoke")}
      {op("disable")}
      {op("enable")}
      {op("delete")}

      <ConfirmAction cancel={cancel} form="user-reset" className={row} trigger={<><Icon name="key" size={16} /> {p.resetPassword}</>} title={p.resetTitle} description={p.resetText(name)} confirm={p.resetConfirm} />
      <ConfirmAction cancel={cancel} form="user-revoke" className={row} trigger={<><Icon name="logout" size={16} className="rtl:-scale-x-100" /> {p.revoke}</>} title={p.revokeTitle} description={p.revokeText(name)} confirm={p.revokeConfirm} />
      {active ? (
        <ConfirmAction cancel={cancel} form="user-disable" className={danger} trigger={<><Icon name="ban" size={16} /> {p.disable}</>} title={p.disableTitle} description={p.disableText(name)} confirm={p.disableConfirm} />
      ) : (
        <button form="user-enable" disabled={pending} className={row}><Icon name="check" size={16} /> {p.enable}</button>
      )}
      <ConfirmAction cancel={cancel} form="user-delete" className={danger} trigger={<><Icon name="trash" size={16} /> {p.delete}</>} title={p.deleteTitle} description={p.deleteText(name)} confirm={p.deleteConfirm} />
    </div>
  );
}
