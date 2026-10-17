"use client";

import { useCurrency } from "./providers/CurrencyProvider";

/** An OMR amount shown in the visitor's currency. `dir="ltr"` keeps "OMR 7.800" intact inside Arabic text. */
export default function Money({ amount, className }: { amount: number | null | undefined; className?: string }) {
  const { format } = useCurrency();
  if (amount === null || amount === undefined) return null;
  return (
    <bdi className={className} suppressHydrationWarning>
      {format(amount)}
    </bdi>
  );
}
