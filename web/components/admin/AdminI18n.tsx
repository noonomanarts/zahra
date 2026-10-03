"use client";

import { createContext, useContext } from "react";
import { getAdminDictionary, type AdminDictionary } from "@/lib/i18n/admin";
import type { Locale } from "@/lib/i18n/config";

const Ctx = createContext<{ lang: Locale; t: AdminDictionary } | null>(null);

export default function AdminI18nProvider({ lang, children }: { lang: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={{ lang, t: getAdminDictionary(lang) }}>{children}</Ctx.Provider>;
}

export function useAdminI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminI18n must be used inside <AdminI18nProvider>");
  return ctx;
}
