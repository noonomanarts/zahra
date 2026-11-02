"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
        className="w-[5.5rem] cursor-pointer appearance-none rounded-full bg-transparent py-1 ps-2.5 pe-6 outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60 sm:w-auto [&>option]:text-ink"
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

type NavItem = { label: string; href: string; children?: { label: string; href: string }[] };

const chevron = (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
    <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/** Desktop menu item with a dropdown that opens on hover, keyboard focus or tap. */
function NavDropdown({ item, href, active, isActive }: { item: NavItem; href: (h: string) => string; active: boolean; isActive: (h: string) => boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // eslint-disable-next-line react-hooks/set-state-in-effect -- close after navigating
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div
      ref={box}
      className="relative flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(e) => !box.current?.contains(e.relatedTarget as Node) && setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          box.current?.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
    >
      <Link
        href={href(item.href)}
        aria-current={active ? "page" : undefined}
        className={`py-7 text-[15px] whitespace-nowrap transition-colors hover:text-brand-dark ${active ? "font-semibold text-brand-dark" : ""}`}
      >
        {item.label}
      </Link>
      <button
        type="button"
        aria-expanded={open}
        aria-label={t.nav.submenu(item.label)}
        onClick={() => setOpen((o) => !o)}
        className={`ms-0.5 grid h-7 w-6 place-items-center rounded transition-transform hover:text-brand-dark focus-visible:outline-2 focus-visible:outline-brand-dark ${open ? "rotate-180" : ""}`}
      >
        {chevron}
      </button>
      <div
        className={`absolute start-1/2 top-full z-50 w-72 -translate-x-1/2 pt-1 transition duration-150 rtl:translate-x-1/2 ${open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"}`}
      >
        <div className="rounded-2xl border border-line bg-white p-2 shadow-xl shadow-ink/5">
          <ul>
            {item.children!.map((c) => (
              <li key={c.href}>
                <Link
                  href={href(c.href)}
                  aria-current={isActive(c.href) ? "page" : undefined}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors hover:bg-brand-soft hover:text-brand-dark ${isActive(c.href) ? "bg-brand-soft/60 font-medium text-brand-dark" : ""}`}
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-line pt-1">
            <Link href={href(item.href)} className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-soft">
              {t.shop.browseAll(item.label)}
              <span aria-hidden="true" className="rtl:rotate-180">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Header({ lang, logo, name, menu }: {
  lang: Locale;
  logo: string | null;
  name: string;
  menu: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState<{ name: string; email: string } | null>(null);
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomer() {
      try {
        const response = await fetch("/api/customer", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data: { customer: { name: string; email: string } | null } = await response.json();
        if (!controller.signal.aborted) setCustomer(data.customer);
      } catch {
        // Account access remains available if the visitor is offline.
      }
    }

    void loadCustomer();
    return () => controller.abort();
  }, [pathname]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- the mobile menu closes after navigating
  useEffect(() => setOpen(false), [pathname]);

  const href = (h: string) => localizeHref(lang, h);
  const items: NavItem[] = menu.map((m) => ({
    label: pick(m.label, lang),
    href: m.href === "#" ? "/shop" : m.href,
    children: m.children?.length ? m.children.map((c) => ({ label: pick(c.label, lang), href: c.href })) : undefined,
  }));
  const isActive = (h: string) => (h === "/" ? pathname === `/${lang}` : pathname === href(h) || pathname.startsWith(`${href(h)}/`));
  const itemActive = (item: NavItem) => isActive(item.href) || !!item.children?.some((c) => isActive(c.href));

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      {/* Account access stays visible on mobile alongside language and currency. */}
      <div className="bg-brand-dark text-[13px] text-white">
        <div className="mx-auto flex min-h-11 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
          <p className="hidden truncate lg:block">{t.topbar.shipping}</p>
          <div className="flex shrink-0 items-center gap-1 sm:ms-auto">
            {customer ? (
              <Link
                href={href("/account")}
                title={customer.name}
                aria-current={isActive("/account") ? "page" : undefined}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-3"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
                </svg>
                {t.nav.account}
              </Link>
            ) : (
              <>
                <Link
                  href={href("/login")}
                  aria-current={isActive("/login") ? "page" : undefined}
                  className="inline-flex min-h-9 items-center rounded-full px-2 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-3"
                >
                  {t.nav.login}
                </Link>
                <Link
                  href={href("/register")}
                  aria-current={isActive("/register") ? "page" : undefined}
                  className="inline-flex min-h-8 items-center rounded-full border border-white/40 px-2.5 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-3"
                >
                  {t.nav.register}
                </Link>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <LanguageSwitch lang={lang} />
            <span className="h-4 w-px bg-white/30" aria-hidden="true" />
            <CurrencySwitch />
          </div>
        </div>
      </div>

      <div className="bg-header">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 xl:gap-6">
          <Link href={href("/")} aria-label={name} className="shrink-0">
            {logo ? <Image src={logo} alt={name} width={146} height={56} priority className="h-11 w-auto xl:h-12" /> : name}
          </Link>

          <nav className="hidden items-center gap-5 lg:flex xl:gap-7" aria-label={t.nav.mainNav}>
            {items.map((item) =>
              item.children ? (
                <NavDropdown key={item.href + item.label} item={item} href={href} active={itemActive(item)} isActive={isActive} />
              ) : (
                <Link
                  key={item.href + item.label}
                  href={href(item.href)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`py-7 text-[15px] whitespace-nowrap transition-colors hover:text-brand-dark ${isActive(item.href) ? "font-semibold text-brand-dark" : ""}`}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="flex items-center gap-3">
            <Link href={`${href("/shop")}#shop-search`} aria-label={t.shop.search} title={t.shop.search} className="grid size-10 place-items-center rounded-full transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand-dark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            </Link>
            <CartButton />
            <Link
              href={href("/shop")}
              className="hidden rounded-full bg-brand-dark px-5 py-2.5 text-sm whitespace-nowrap text-white transition-colors hover:bg-ink sm:inline-block lg:hidden 2xl:inline-block"
            >
              {t.nav.shopNow}
            </Link>
            <button
              className="grid h-11 w-11 place-items-center rounded-xl lg:hidden"
              aria-label={t.nav.toggleMenu}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((o) => !o)}
            >
              <span className="relative block h-4 w-6" aria-hidden="true">
                <span className={`absolute inset-x-0 top-0 h-0.5 bg-ink transition ${open ? "top-[7px] rotate-45" : ""}`} />
                <span className={`absolute inset-x-0 top-[7px] h-0.5 bg-ink transition ${open ? "opacity-0" : ""}`} />
                <span className={`absolute inset-x-0 top-[14px] h-0.5 bg-ink transition ${open ? "top-[7px] -rotate-45" : ""}`} />
              </span>
            </button>
          </div>
        </div>

        {open && (
          <nav id="mobile-menu" className="max-h-[calc(100dvh-7.75rem)] overflow-y-auto border-t border-ink/10 bg-header px-4 pt-2 pb-6 lg:hidden" aria-label={t.nav.mainNav}>
            <ul className="divide-y divide-ink/10">
              <li>
                <Link href={href("/")} aria-current={isActive("/") ? "page" : undefined} className="flex min-h-12 items-center text-base">{t.nav.home}</Link>
              </li>
              {items.map((item) => (
                <li key={item.href + item.label}>
                  {item.children ? (
                    <details className="group" open={itemActive(item)}>
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-base [&::-webkit-details-marker]:hidden">
                        <span className={itemActive(item) ? "font-semibold text-brand-dark" : ""}>{item.label}</span>
                        <span className="grid h-8 w-8 place-items-center transition-transform group-open:rotate-180">{chevron}</span>
                      </summary>
                      <ul className="mb-3 space-y-0.5 rounded-2xl bg-white/50 p-2">
                        {item.children.map((c) => (
                          <li key={c.href}>
                            <Link href={href(c.href)} aria-current={isActive(c.href) ? "page" : undefined} className={`flex min-h-11 items-center rounded-xl px-3 text-[15px] ${isActive(c.href) ? "bg-white font-medium text-brand-dark" : "text-ink/80"}`}>
                              {c.label}
                            </Link>
                          </li>
                        ))}
                        <li>
                          <Link href={href(item.href)} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-brand-dark">
                            {t.shop.browseAll(item.label)} <span aria-hidden="true" className="rtl:rotate-180">→</span>
                          </Link>
                        </li>
                      </ul>
                    </details>
                  ) : (
                    <Link href={href(item.href)} aria-current={isActive(item.href) ? "page" : undefined} className={`flex min-h-12 items-center text-base ${isActive(item.href) ? "font-semibold text-brand-dark" : ""}`}>
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <Link href={href("/shop")} className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-brand-dark text-white">{t.nav.shopNow}</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
