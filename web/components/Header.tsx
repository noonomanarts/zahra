"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { CURRENCIES, CURRENCY_INFO, type CurrencyCode } from "@/lib/currency";
import { LOCALE_COOKIE, LOCALE_NAMES, localizeHref, pick, type Locale } from "@/lib/i18n/config";
import type { MenuItem } from "@/lib/types";
import CartButton from "./cart/CartButton";
import { useCurrency } from "./providers/CurrencyProvider";
import { useI18n } from "./providers/I18nProvider";

function LanguageSwitch({ lang }: { lang: Locale }) {
  const pathname = usePathname();
  const other: Locale = lang === "ar" ? "en" : "ar";
  const href = pathname.replace(/^\/(en|ar)(?=\/|$)/, `/${other}`);
  return (
    <Link
      href={href}
      hrefLang={other}
      lang={other}
      onClick={() => (document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=31536000; samesite=lax`)}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors hover:bg-white/15"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
      </svg>
      {LOCALE_NAMES[other]}
    </Link>
  );
}

function CurrencySwitch() {
  const { lang, t } = useI18n();
  const { currency, setCurrency } = useCurrency();
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t.topbar.currency}</span>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
        className="cursor-pointer appearance-none rounded-full bg-transparent py-1 ps-2.5 pe-6 outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60 [&>option]:text-ink"
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {CURRENCY_INFO[c].flag} {c} – {CURRENCY_INFO[c][lang]}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute end-2" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </label>
  );
}

export default function Header({ lang, logo, name, menu }: { lang: Locale; logo: string | null; name: string; menu: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();
  const href = (h: string) => localizeHref(lang, h);
  const items = [
    { label: t.nav.home, href: "/", children: undefined },
    ...menu.map((m) => ({
      label: pick(m.label, lang),
      href: m.href === "#" ? "/shop" : m.href,
      children: m.children?.map((c) => ({ label: pick(c.label, lang), href: c.href })),
    })),
  ];
  const isActive = (h: string) => (h === "/" ? pathname === `/${lang}` : pathname.startsWith(href(h)));

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      {/* top bar: shipping note, language and currency */}
      <div className="bg-brand-dark text-[13px] text-white">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <p className="hidden truncate sm:block">{t.topbar.shipping}</p>
          <div className="ms-auto flex items-center gap-1">
            <LanguageSwitch lang={lang} />
            <span className="h-4 w-px bg-white/30" aria-hidden="true" />
            <CurrencySwitch />
          </div>
        </div>
      </div>

      <div className="bg-header">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link href={href("/")} aria-label={name} className="shrink-0">
            {logo ? <Image src={logo} alt={name} width={146} height={56} priority className="h-12 w-auto" /> : name}
          </Link>

          <nav className="hidden items-center gap-8 lg:flex" aria-label={t.nav.mainNav}>
            {items.map((item) => (
              <div key={item.href + item.label} className="group relative">
                <Link
                  href={href(item.href)}
                  className={`py-7 text-[15px] transition-colors hover:text-brand-dark ${isActive(item.href) ? "font-semibold text-brand-dark" : ""}`}
                >
                  {item.label}
                  {item.children && <span className="ms-1 text-xs">▾</span>}
                </Link>
                {item.children && (
                  <div className="invisible absolute start-1/2 top-full w-56 -translate-x-1/2 rounded-xl border border-line bg-white p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 rtl:translate-x-1/2">
                    {item.children.map((c) => (
                      <Link key={c.href} href={href(c.href)} className="block rounded-lg px-4 py-2.5 text-sm hover:bg-brand-soft hover:text-brand-dark">
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <CartButton />
            <Link
              href={href("/shop")}
              className="hidden rounded-full bg-brand-dark px-5 py-2.5 text-sm text-white transition-colors hover:bg-ink sm:inline-block"
            >
              {t.nav.shopNow}
            </Link>
            <button className="rounded-lg p-2 lg:hidden" aria-label={t.nav.toggleMenu} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <span className="block h-0.5 w-6 bg-ink" />
              <span className="mt-1.5 block h-0.5 w-6 bg-ink" />
              <span className="mt-1.5 block h-0.5 w-6 bg-ink" />
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-ink/10 bg-header px-4 py-4 lg:hidden" aria-label={t.nav.mainNav}>
            {items.map((item) => (
              <div key={item.href + item.label}>
                <Link href={href(item.href)} onClick={() => setOpen(false)} className="block py-2.5 text-base">
                  {item.label}
                </Link>
                {item.children?.map((c) => (
                  <Link key={c.href} href={href(c.href)} onClick={() => setOpen(false)} className="block py-2 ps-4 text-sm text-muted">
                    {c.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
