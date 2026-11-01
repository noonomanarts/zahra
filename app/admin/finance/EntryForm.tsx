"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Field, FormMessage, btnCls, inputCls } from "@/components/admin/ui";
import { addEntry, type EntryState } from "./actions";

export default function EntryForm({ today, categories }: { today: string; categories: readonly string[] }) {
  const { t } = useAdminI18n();
  const f = t.finance;
  const [state, action, pending] = useActionState<EntryState, FormData>(addEntry, {});
  return (
    <form key={state.key} action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[150px_1.4fr_1fr_1.6fr_120px_auto] lg:items-end">
      <Field label={f.date}><input name="date" type="date" required defaultValue={today} dir="ltr" className={inputCls} /></Field>
      <Field label={f.kind}>
        <select name="kind" defaultValue="cost" className={inputCls}>
          {Object.entries(f.kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label={f.category}>
        <select name="category" defaultValue="materials" className={inputCls}>
          {categories.map((c) => <option key={c} value={c}>{f.categories[c]}</option>)}
        </select>
      </Field>
      <Field label={f.description}><input name="description" required maxLength={200} className={inputCls} /></Field>
      <Field label={f.amount}><input name="amount" type="number" required min="0.001" step="0.001" dir="ltr" className={inputCls} /></Field>
      <button disabled={pending} className={btnCls}>{pending ? t.common.saving : f.add}</button>
      <div className="sm:col-span-2 lg:col-span-6"><FormMessage state={state} /></div>
    </form>
  );
}
