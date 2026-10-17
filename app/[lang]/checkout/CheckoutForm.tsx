"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import Money from "@/components/Money";
import { useCart } from "@/components/cart/CartProvider";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { formatMoney } from "@/lib/currency";
import { pick } from "@/lib/i18n/config";
import { checkout, type CheckoutState } from "./actions";

const field = "w-full rounded-xl border border-line bg-white px-4 py-3 outline-none transition focus:border-brand";

export default function CheckoutForm({ shippingFee, paymentOnline }: { shippingFee: number; paymentOnline: boolean }) {
  const { items, subtotal, ready } = useCart();
  const { lang, t, href } = useI18n();
  const { currency } = useCurrency();
  const [state, action, pending] = useActionState<CheckoutState, FormData>(checkout, {});

  useEffect(() => {
    if (state.redirectTo) window.location.assign(state.redirectTo);
  }, [state.redirectTo]);

  if (!ready) return null;
  if (!items.length) {
    return (
      <p className="text-muted">
        {t.checkout.emptyCart}{" "}
        <Link href={href("/shop")} className="text-brand-dark underline">{t.checkout.continueShopping}</Link>
      </p>
    );
  }

  const needsShipping = items.some((i) => !i.digital);
  const shipping = needsShipping ? shippingFee : 0;
  const total = subtotal + shipping;
  const v = state.values ?? {};

  return (
    <form action={action} className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <input type="hidden" name="items" value={JSON.stringify(items.map((i) => ({ slug: i.slug, quantity: i.quantity })))} />
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="currency" value={currency} />

      <div className="space-y-8">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-4 text-2xl font-bold">{t.checkout.contact}</legend>
          <input name="name" required placeholder={t.checkout.fullName} defaultValue={v.name} autoComplete="name" className={`${field} sm:col-span-2`} />
          <input name="email" type="email" required dir="ltr" placeholder={t.checkout.email} defaultValue={v.email} autoComplete="email" className={`${field} rtl:text-right`} />
          <input name="phone" type="tel" required dir="ltr" placeholder={t.checkout.phone} defaultValue={v.phone} autoComplete="tel" className={`${field} rtl:text-right`} />
        </fieldset>

        {needsShipping && (
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-4 text-2xl font-bold">{t.checkout.shippingAddress}</legend>
            <input name="country" required placeholder={t.checkout.country} defaultValue={v.country ?? t.checkout.defaultCountry} autoComplete="country-name" className={field} />
            <input name="city" required placeholder={t.checkout.city} defaultValue={v.city} autoComplete="address-level2" className={field} />
            <input name="address" required placeholder={t.checkout.address} defaultValue={v.address} autoComplete="street-address" className={`${field} sm:col-span-2`} />
          </fieldset>
        )}

        <textarea name="notes" rows={3} placeholder={t.checkout.notes} defaultValue={v.notes} className={field} />
      </div>

      <aside className="h-fit rounded-3xl bg-brand-soft p-6">
        <h2 className="text-xl font-bold">{t.checkout.yourOrder}</h2>
        <ul className="mt-4 divide-y divide-brand/15 text-sm">
          {items.map((i) => (
            <li key={i.slug} className="flex justify-between gap-4 py-3">
              <span>{pick(i.name, lang)} <span className="text-muted">× {i.quantity}</span></span>
              <Money amount={i.price * i.quantity} className="shrink-0" />
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-brand/15 pt-4 text-sm">
          <div className="flex justify-between"><dt>{t.checkout.subtotal}</dt><dd><Money amount={subtotal} /></dd></div>
          {needsShipping && (
            <div className="flex justify-between">
              <dt>{t.checkout.shipping}</dt>
              <dd>{shipping ? <Money amount={shipping} /> : t.checkout.free}</dd>
            </div>
          )}
          <div className="flex justify-between pt-2 text-base font-bold"><dt>{t.checkout.total}</dt><dd><Money amount={total} /></dd></div>
        </dl>
        {currency !== "OMR" && (
          <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs text-muted">
            {t.checkout.chargedIn(formatMoney(total, "OMR", lang))}
          </p>
        )}

        {state.error && <p role="alert" className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-red-700">{state.error}</p>}

        <button
          disabled={pending || !!state.redirectTo}
          className="mt-6 w-full rounded-full bg-brand px-6 py-4 text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {pending || state.redirectTo ? t.checkout.wait : paymentOnline ? t.checkout.payNow : t.checkout.placeOrder}
        </button>
        <p className="mt-3 text-center text-xs text-muted">{paymentOnline ? t.checkout.redirectNote : t.checkout.offlineNote}</p>
      </aside>
    </form>
  );
}
