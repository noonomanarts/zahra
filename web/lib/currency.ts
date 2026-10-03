import type { Locale } from "@/lib/i18n/config";

/** Prices are stored and charged in OMR; the others are display currencies. */
export const BASE_CURRENCY = "OMR";
export const CURRENCIES = ["OMR", "AED", "SAR", "QAR", "KWD", "BHD", "IQD"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];
export type Rates = Record<CurrencyCode, number>;
export const CURRENCY_COOKIE = "currency";

export const isCurrency = (v: string | undefined | null): v is CurrencyCode => CURRENCIES.includes(v as CurrencyCode);

export const CURRENCY_INFO: Record<CurrencyCode, { en: string; ar: string; flag: string; decimals: number }> = {
  OMR: { en: "Omani Rial", ar: "ريال عماني", flag: "🇴🇲", decimals: 3 },
  AED: { en: "UAE Dirham", ar: "درهم إماراتي", flag: "🇦🇪", decimals: 2 },
  SAR: { en: "Saudi Riyal", ar: "ريال سعودي", flag: "🇸🇦", decimals: 2 },
  QAR: { en: "Qatari Riyal", ar: "ريال قطري", flag: "🇶🇦", decimals: 2 },
  KWD: { en: "Kuwaiti Dinar", ar: "دينار كويتي", flag: "🇰🇼", decimals: 3 },
  BHD: { en: "Bahraini Dinar", ar: "دينار بحريني", flag: "🇧🇭", decimals: 3 },
  IQD: { en: "Iraqi Dinar", ar: "دينار عراقي", flag: "🇮🇶", decimals: 0 },
};

/**
 * Starting rates (units per 1 OMR) from the official USD pegs: OMR 0.3845, AED 3.6725, SAR 3.75,
 * QAR 3.64, BHD 0.376, IQD 1310 (CBI); KWD follows a basket, ≈0.3075. Replaced by approved Bank Muscat rates.
 */
export const DEFAULT_RATES: Rates = {
  OMR: 1,
  AED: 9.5514,
  SAR: 9.7529,
  QAR: 9.4668,
  KWD: 0.7997,
  BHD: 0.9779,
  IQD: 3407,
};

export function convert(amountOmr: number, currency: CurrencyCode, rates: Rates) {
  return currency === "OMR" ? amountOmr : amountOmr * (rates[currency] ?? DEFAULT_RATES[currency]);
}

const formatters = new Map<string, Intl.NumberFormat>();

/** "OMR 7.800" / "‏7.800 ر.ع.‏" — Latin digits in both languages for clarity. */
export function formatMoney(amount: number, currency: CurrencyCode, lang: Locale) {
  const key = `${lang}-${currency}`;
  let f = formatters.get(key);
  if (!f) {
    const decimals = CURRENCY_INFO[currency].decimals;
    f = new Intl.NumberFormat(lang === "ar" ? "ar-u-nu-latn" : "en", {
      style: "currency",
      currency,
      currencyDisplay: lang === "ar" ? "symbol" : "code",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formatters.set(key, f);
  }
  return f.format(amount).replace(/ /g, " ");
}
