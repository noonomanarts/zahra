"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Field, FormMessage, btnCls, inputCls } from "@/components/admin/ui";
import { REQUEST_STATUSES } from "@/db/schema";
import { updateRequest, type RequestFormState } from "./actions";

export default function RequestForm({ id, status, notes }: { id: number; status: string; notes: string }) {
  const { t } = useAdminI18n();
  const r = t.requests;
  const [state, action, pending] = useActionState<RequestFormState, FormData>(updateRequest, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <Field label={r.status}>
        <select name="status" defaultValue={status} className={inputCls}>
          {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{r.statuses[s]}</option>)}
        </select>
      </Field>
      <Field label={r.notes} hint={r.notesHint}>
        <textarea name="adminNotes" rows={5} defaultValue={notes} className={inputCls} />
      </Field>
      <FormMessage state={state} />
      <button disabled={pending} className={`${btnCls} w-full`}>{pending ? t.common.saving : r.save}</button>
    </form>
  );
}
