"use client";

import { useActionState, useState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { ToggleField } from "@/components/admin/motion";
import { Field, FormMessage, btnCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { saveCoupon, type CouponState } from "./actions";

export type CouponValues = { id: number; code: string; type: "percent" | "fixed"; value: number; minSubtotal: number | null; maxUses: number | null; oncePerCustomer: boolean; startsOn: string | null; endsOn: string | null; active: boolean };

export default function CouponForm({ coupon, onDone }: { coupon?: CouponValues; onDone?: () => void }) {
  const { t } = useAdminI18n();
  const c = t.coupons;
  const [state, action, pending] = useActionState<CouponState, FormData>(saveCoupon, {});
  const [type, setType] = useState(coupon?.type ?? "percent");
  return (
    // a new form after each save, so the next coupon starts empty
    <form key={coupon ? coupon.id : state.saved} action={action} className="grid gap-4 sm:grid-cols-2">
      {coupon && <input type="hidden" name="id" value={coupon.id} />}
      <Field label={c.code} hint={c.codeHint}><input name="code" required dir="ltr" maxLength={30} autoComplete="off" defaultValue={coupon?.code} className={`${inputCls} uppercase`} /></Field>
      <Field label={c.type}>
        <select name="type" value={type} onChange={(e) => setType(e.target.value as "percent" | "fixed")} className={inputCls}>
          <option value="percent">{c.types.percent}</option>
          <option value="fixed">{c.types.fixed}</option>
        </select>
      </Field>
      <Field label={type === "percent" ? c.valuePercent : c.valueFixed}><input name="value" type="number" required dir="ltr" min="0.001" max={type === "percent" ? 100 : undefined} step="0.001" defaultValue={coupon?.value} className={inputCls} /></Field>
      <Field label={c.minSubtotal} hint={c.optional}><input name="minSubtotal" type="number" dir="ltr" min="0" step="0.001" defaultValue={coupon?.minSubtotal ?? ""} className={inputCls} /></Field>
      <Field label={c.startsOn} hint={c.optional}><input name="startsOn" type="date" dir="ltr" defaultValue={coupon?.startsOn ?? ""} className={inputCls} /></Field>
      <Field label={c.endsOn} hint={c.endsHint}><input name="endsOn" type="date" dir="ltr" defaultValue={coupon?.endsOn ?? ""} className={inputCls} /></Field>
      <Field label={c.maxUses} hint={c.maxUsesHint}><input name="maxUses" type="number" dir="ltr" min="1" step="1" defaultValue={coupon?.maxUses ?? ""} className={inputCls} /></Field>
      <div className="space-y-3 pt-1">
        <ToggleField name="oncePerCustomer" label={c.oncePerCustomer} description={c.oncePerCustomerHint} defaultChecked={coupon?.oncePerCustomer ?? false} />
        <ToggleField name="active" label={c.active} defaultChecked={coupon?.active ?? true} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className={btnCls}>{pending ? t.common.saving : coupon ? t.common.save : c.add}</button>
        {onDone && <button type="button" onClick={onDone} className={btnSecondaryCls}>{t.common.cancel}</button>}
        <FormMessage state={state} />
      </div>
    </form>
  );
}
