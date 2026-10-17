"use client";

import Link from "next/link";
import Image from "next/image";
import Money from "@/components/Money";
import { useCart } from "@/components/cart/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { pick } from "@/lib/i18n/config";

export default function CartView() {
  const { items, subtotal, ready, setQuantity, remove } = useCart();
  const { lang, t, href } = useI18n();
  if (!ready) return null;

  if (!items.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-muted">{t.cart.empty}</p>
        <Link href={href("/shop")} className="mt-6 inline-block rounded-full bg-brand px-8 py-3 text-white hover:bg-brand-dark">
          {t.cart.browse}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <ul className="divide-y divide-line border-y border-line">
        {items.map((item) => {
          const name = pick(item.name, lang);
          return (
            <li key={item.slug} className="flex items-center gap-4 py-5">
              <Link href={href(`/products/${item.slug}`)} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-brand-soft">
                {item.image && <Image src={item.image} alt={name} fill sizes="96px" className="object-cover" />}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={href(`/products/${item.slug}`)} className="line-clamp-2 hover:text-brand-dark">{name}</Link>
                <p className="mt-1 text-sm text-muted">
                  <Money amount={item.price} />
                  {item.digital && ` · ${t.catalog.pdf}`}
                </p>
                <button onClick={() => remove(item.slug)} className="mt-2 text-xs text-muted underline hover:text-red-700">
                  {t.cart.remove}
                </button>
              </div>
              {!item.digital && (
                <div className="flex items-center rounded-full border border-line">
                  <button className="px-3 py-2" aria-label={t.product.decrease} onClick={() => setQuantity(item.slug, item.quantity - 1)}>−</button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button className="px-3 py-2" aria-label={t.product.increase} onClick={() => setQuantity(item.slug, item.quantity + 1)}>+</button>
                </div>
              )}
              <p className="w-28 text-end font-semibold"><Money amount={item.price * item.quantity} /></p>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit rounded-3xl bg-brand-soft p-6">
        <div className="flex justify-between text-lg font-bold">
          <span>{t.cart.subtotal}</span>
          <Money amount={subtotal} />
        </div>
        <p className="mt-2 text-sm text-muted">{t.cart.shippingAtCheckout}</p>
        <Link href={href("/checkout")} className="mt-6 block rounded-full bg-brand px-6 py-4 text-center text-white hover:bg-brand-dark">
          {t.cart.checkout}
        </Link>
      </aside>
    </div>
  );
}
