"use client";

import { useActionState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { FormMessage, btnCls, inputCls } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { grantWorkshop, type GrantState } from "../actions";

/** Give a customer account access by email; suggests the shop's customers while typing. */
export default function GrantForm({ productId, customers }: { productId: number; customers: { name: string; email: string }[] }) {
  const { t } = useAdminI18n();
  const w = t.workshops;
  const [state, action, pending] = useActionState<GrantState, FormData>(grantWorkshop, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-zinc-700">{w.grantEmail}</span>
        <span className="relative block" dir="ltr">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="users" size={16} /></span>
          <input name="email" type="email" required dir="ltr" list={`customers-${productId}`} autoComplete="off" placeholder="name@example.com" className={`${inputCls} ps-9`} />
        </span>
        <datalist id={`customers-${productId}`}>
          {customers.map((c) => <option key={c.email} value={c.email}>{c.name}</option>)}
        </datalist>
      </label>
      <button disabled={pending} className={`${btnCls} w-full`}>
        <Icon name="plus" size={16} /> {pending ? w.granting : w.grant}
      </button>
      <FormMessage state={pending ? undefined : state} />
    </form>
  );
}
