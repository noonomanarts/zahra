"use client";

import { createContext, useContext } from "react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizeHref, type Locale } from "@/lib/i18n/config";

type I18n = { lang: Locale; t: ReturnType<typeof getDictionary>; href: (path: string) => string };

const I18nContext = createContext<I18n | null>(null);

export default function I18nProvider({ lang, children }: { lang: Locale; children: React.ReactNode }) {
  return (
    <I18nContext.Provider value={{ lang, t: getDictionary(lang), href: (p) => localizeHref(lang, p) }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
