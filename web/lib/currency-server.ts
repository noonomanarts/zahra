import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrencySettings } from "@/db/schema";
import { CURRENCIES, DEFAULT_RATES, type CurrencyCode, type Rates } from "./currency";

// Bank Muscat publishes "OMR per 1 unit" buy/sell rates on its treasury page (server-rendered HTML).
export const BANK_MUSCAT_URL = "https://www.bankmuscat.om/en/treasury/Pages/default.aspx";

export const getCurrencySettings = cache(async (): Promise<CurrencySettings> => {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, "currency") });
  const value = row?.value as Partial<CurrencySettings> | undefined;
  return {
    rates: { ...DEFAULT_RATES, ...value?.rates, OMR: 1 },
    approvedAt: value?.approvedAt ?? null,
    pending: value?.pending ?? null,
  };
});

export async function getRates(): Promise<Rates> {
  return (await getCurrencySettings()).rates;
}

export async function saveCurrencySettings(value: CurrencySettings) {
  await db
    .insert(schema.settings)
    .values({ key: "currency", value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

/**
 * Reads Bank Muscat's forex table and returns display rates (units per 1 OMR) from the mid rate.
 * Currencies the bank doesn't publish (e.g. IQD) are simply missing from the result.
 */
export async function fetchBankMuscatRates() {
  const res = await fetch(BANK_MUSCAT_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ZahrasDesignStudio/1.0; +https://zahrasdesignstudio.com)" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Bank Muscat responded with ${res.status}`);
  const html = await res.text();

  const cell = String.raw`<div class=['"]Cell['"]>\s*<p>\s*([^<]*?)\s*</p>\s*</div>`;
  const row = new RegExp(String.raw`<div class=['"]Row['"]>\s*${cell}\s*${cell}\s*${cell}`, "g");

  const quotes: CurrencySettings["pending"] & object = { rates: {}, quotes: {}, fetchedAt: new Date().toISOString() };
  for (const [, code, buy, sell] of html.matchAll(row)) {
    const c = code.trim().toUpperCase() as CurrencyCode;
    const b = Number(buy);
    const s = Number(sell);
    if (!CURRENCIES.includes(c) || c === "OMR" || !(b > 0) || !(s > 0)) continue;
    const omrPerUnit = (b + s) / 2;
    quotes.quotes[c] = { buy: b, sell: s };
    quotes.rates[c] = Math.round((1 / omrPerUnit) * 10_000) / 10_000;
  }
  if (!Object.keys(quotes.rates).length) throw new Error("No rates found on the Bank Muscat page (the page layout may have changed).");
  return quotes;
}
