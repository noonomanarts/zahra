"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CURRENCY_COOKIE, convert, formatMoney, isCurrency, type CurrencyCode, type Rates } from "@/lib/currency";
import { useI18n } from "./I18nProvider";

type CurrencyContextValue = {
  currency: CurrencyCode;
  rates: Rates;
  setCurrency: (c: CurrencyCode) => void;
  /** formats an OMR amount in the selected currency */
  format: (amountOmr: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

/**
 * The visitor's display currency lives in a cookie and is applied in the browser,
 * so product pages stay statically generated. Prices are always stored and charged in OMR.
 */
export default function CurrencyProvider({ rates, children }: { rates: Rates; children: React.ReactNode }) {
  const { lang } = useI18n();
  const [currency, setCurrencyState] = useState<CurrencyCode>("OMR");

  useEffect(() => {
    const saved = document.cookie.match(new RegExp(`(?:^|; )${CURRENCY_COOKIE}=([A-Z]{3})`))?.[1];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved preference once on mount
    if (isCurrency(saved)) setCurrencyState(saved);
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    document.cookie = `${CURRENCY_COOKIE}=${c}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const format = useCallback((amountOmr: number) => formatMoney(convert(amountOmr, currency, rates), currency, lang), [currency, rates, lang]);

  return <CurrencyContext.Provider value={{ currency, rates, setCurrency, format }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside <CurrencyProvider>");
  return ctx;
}
