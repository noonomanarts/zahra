"use client";

import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import type { L } from "@/lib/types";

/** Adds the workshop to the cart and goes straight to checkout. */
export default function BuyWorkshopButton({ slug, name, price, currency, image, className = "" }: {
  slug: string;
  name: L;
  price: number;
  currency: string;
  image: string | null;
  className?: string;
}) {
  const { add } = useCart();
  const { t, href } = useI18n();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        add({ slug, name, price, currency, image, digital: true, workshop: true }, 1);
        router.push(href("/checkout"));
      }}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-dark px-5 text-sm font-medium text-white transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark ${className}`}
    >
      {t.workshops.buy}
    </button>
  );
}
