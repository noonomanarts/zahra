import type { L } from "@/lib/types";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";

export const isLocale = (value: string | undefined): value is Locale => LOCALES.includes(value as Locale);
export const dirOf = (lang: Locale) => (lang === "ar" ? "rtl" : "ltr");
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية" };

/** Picks the text for a language, falling back to English when the Arabic is empty. */
export function pick(text: L | string | null | undefined, lang: Locale): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  return (lang === "ar" && text.ar?.trim()) ? text.ar : text.en ?? "";
}

/** True when the text for `lang` falls back to English (shown with dir="ltr"). */
export const isFallback = (text: L, lang: Locale) => lang === "ar" && !text.ar?.trim() && !!text.en?.trim();

const UNLOCALIZED = /^\/(admin|api|uploads|images|fonts|_next)(\/|$)/;

/** Prefixes internal links with the language: "/shop" → "/ar/shop". External links are untouched. */
export function localizeHref(lang: Locale, href: string) {
  if (!href.startsWith("/") || href.startsWith("//") || UNLOCALIZED.test(href)) return href;
  if (/^\/(en|ar)(\/|$|\?|#)/.test(href)) return href.replace(/^\/(en|ar)/, `/${lang}`);
  return href === "/" ? `/${lang}` : `/${lang}${href}`;
}

/** Localizes internal links inside an HTML string. */
export function localizeHtml(html: string, lang: Locale) {
  return html.replace(/href="(\/[^"]*)"/g, (_, href: string) => `href="${localizeHref(lang, href)}"`);
}
