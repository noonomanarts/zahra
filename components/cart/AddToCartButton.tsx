"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart, type CartItem } from "./CartProvider";
import { useI18n } from "../providers/I18nProvider";

export default function AddToCartButton({ item, disabled, buyNow }: { item: Omit<CartItem, "quantity">; disabled?: boolean; buyNow?: string }) {
  const { add } = useCart();
  const { t, href } = useI18n();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (disabled) {
    return <p className="mt-8 rounded-2xl bg-brand-soft px-5 py-4 text-muted">{t.product.outOfStockLong}</p>;
  }

  // workshops: one click to checkout
  if (buyNow) {
    return (
      <button
        type="button"
        onClick={() => {
          add(item, 1);
          router.push(href("/checkout"));
        }}
        className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-dark px-10 text-white transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark sm:w-auto"
      >
        {buyNow}
        <span aria-hidden="true" className="rtl:rotate-180">→</span>
      </button>
    );
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      {!item.digital && (
        <div className="flex items-center rounded-full border border-line">
          <button type="button" className="px-4 py-3" aria-label={t.product.decrease} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
            −
          </button>
          <span className="w-8 text-center" aria-live="polite">{quantity}</span>
          <button type="button" className="px-4 py-3" aria-label={t.product.increase} onClick={() => setQuantity((q) => q + 1)}>
            +
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          add(item, quantity);
          setAdded(true);
        }}
        className="rounded-full bg-brand px-10 py-4 text-white transition-colors hover:bg-brand-dark"
      >
        {t.product.addToCart}
      </button>
      {added && (
        <Link href={href("/cart")} className="text-sm text-brand-dark underline underline-offset-4">
          {t.product.added}
        </Link>
      )}
    </div>
  );
}
