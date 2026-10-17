"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { L } from "@/lib/types";

export type CartItem = {
  slug: string;
  name: L;
  price: number;
  currency: string;
  image: string | null;
  digital: boolean;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  ready: boolean;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (slug: string, quantity: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "zds-cart";

/** Carts saved before the site was bilingual stored the name as a plain string. */
const migrate = (items: CartItem[]) =>
  items.map((i) => (typeof i.name === "string" ? { ...i, name: { en: i.name as string, ar: "" } } : i));
const CartContext = createContext<CartContextValue | null>(null);

/** Cart lives in the browser; prices are re-checked on the server at checkout. */
export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage once on mount
      if (saved) setItems(migrate(JSON.parse(saved)));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, ready]);

  const add = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.slug === item.slug);
      if (existing) {
        // digital patterns are bought once
        const next = item.digital ? 1 : existing.quantity + quantity;
        return prev.map((i) => (i.slug === item.slug ? { ...i, ...item, quantity: next } : i));
      }
      return [...prev, { ...item, quantity: item.digital ? 1 : quantity }];
    });
  }, []);

  const setQuantity = useCallback((slug: string, quantity: number) => {
    setItems((prev) =>
      quantity < 1 ? prev.filter((i) => i.slug !== slug) : prev.map((i) => (i.slug === slug ? { ...i, quantity: i.digital ? 1 : quantity } : i)),
    );
  }, []);

  const remove = useCallback((slug: string) => setItems((prev) => prev.filter((i) => i.slug !== slug)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      ready,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((n, i) => n + i.price * i.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [items, ready, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
