"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Badge, Card, FormMessage, LangTag, btnCls, btnDangerCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import type { AdminTerm } from "@/lib/data";
import { deleteTerm, saveTerm, type TermKind, type TermState } from "./actions";

function NameInputs({ term }: { term?: AdminTerm }) {
  const { t } = useAdminI18n();
  return (
    <>
      <div className="relative min-w-44 flex-1">
        <input name="name_en" required dir="ltr" lang="en" defaultValue={term?.name} placeholder={t.terms.nameEn} aria-label={t.terms.nameEn} className={`${inputCls} pe-10`} />
        <LangTag lang="en" />
      </div>
      <div className="relative min-w-44 flex-1">
        <input name="name_ar" dir="rtl" lang="ar" defaultValue={term?.nameAr} placeholder={t.terms.nameAr} aria-label={t.terms.nameAr} className={`${inputCls} pe-10`} />
        <LangTag lang="ar" />
      </div>
    </>
  );
}

function TermRow({ term, kind }: { term: AdminTerm; kind: TermKind }) {
  const { t } = useAdminI18n();
  const [state, action, pending] = useActionState<TermState, FormData>(saveTerm, {});
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={action} className="flex flex-1 flex-wrap items-center gap-2">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={term.id} />
          <NameInputs term={term} />
          <input name="slug" dir="ltr" defaultValue={term.slug} aria-label="Slug" className={`${inputCls} w-44 font-mono text-xs`} />
          <span className="w-20 text-center text-xs text-zinc-500">{t.terms.count(term.count)}</span>
          {!term.nameAr && <Badge status="warning" label={t.common.missingArabic} />}
          <button disabled={pending} className={btnSecondaryCls}>{t.common.save}</button>
        </form>
        <form
          action={deleteTerm}
          onSubmit={(e) => {
            if (!confirm(t.terms.confirmDelete(term.name))) e.preventDefault();
          }}
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={term.id} />
          <button className={btnDangerCls}>{t.common.delete}</button>
        </form>
      </div>
      {state.error && <div className="mt-2"><FormMessage state={state} /></div>}
    </li>
  );
}

export default function TermManager({ kind, terms }: { kind: TermKind; terms: AdminTerm[] }) {
  const { t } = useAdminI18n();
  const [state, action, pending] = useActionState<TermState, FormData>(saveTerm, {});
  const label = kind === "categories" ? t.terms.categories : t.terms.tags;

  return (
    <div className="space-y-6">
      <Card title={kind === "categories" ? t.terms.addCategory : t.terms.addTag}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="kind" value={kind} />
          <NameInputs />
          <input name="slug" dir="ltr" placeholder={t.terms.slug} className={`${inputCls} w-44 font-mono text-xs`} />
          <button disabled={pending} className={btnCls}>{t.common.add}</button>
        </form>
        <div className="mt-3"><FormMessage state={state} /></div>
      </Card>

      <Card title={t.terms.all(label, terms.length)}>
        <ul className="divide-y divide-zinc-100">
          {terms.map((term) => <TermRow key={`${term.id}-${term.slug}-${term.name}-${term.nameAr}`} term={term} kind={kind} />)}
        </ul>
      </Card>
    </div>
  );
}
