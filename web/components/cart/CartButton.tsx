"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";
import { useI18n } from "../providers/I18nProvider";

export default function CartButton() {
  const { count } = useCart();
  const { t, href } = useI18n();
  return (
    <Link href={href("/cart")} aria-label={t.nav.cartItems(count)} className="relative rounded-full p-2 transition-colors hover:bg-white/40">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      {count > 0 && (
        <span className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
