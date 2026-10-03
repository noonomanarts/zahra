import "server-only";
import { cookies } from "next/headers";
import { isLocale, type Locale } from "./config";
import { ADMIN_LOCALE_COOKIE, getAdminDictionary } from "./admin";

/** The admin panel's own language (cookie), independent from the storefront URL. */
export async function getAdminLang(): Promise<Locale> {
  const value = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
}

export async function getAdminT() {
  const lang = await getAdminLang();
  return { lang, t: getAdminDictionary(lang) };
}
