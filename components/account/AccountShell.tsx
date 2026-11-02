import Link from "next/link";
import { logoutCustomer } from "@/app/[lang]/auth-actions";
import type { Customer } from "@/lib/customer-auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizeHref, type Locale } from "@/lib/i18n/config";

type Tab = "overview" | "workshops" | "orders" | "profile";

const ICONS: Record<Tab, React.ReactNode> = {
  overview: <path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-4H4v4Zm10-16v4h6V4h-6Z" />,
  workshops: <path d="M10 8.5v7l6-3.5-6-3.5ZM3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />,
  orders: <path d="M6 7h12l-1 13H7L6 7Zm3 0a3 3 0 0 1 6 0" />,
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9v-1a8 8 0 0 1 16 0v1" />,
};

/** Header band and tab bar shared by every page of the customer account. */
export default function AccountShell({ lang, customer, active, children }: { lang: Locale; customer: Customer; active: Tab; children: React.ReactNode }) {
  const t = getDictionary(lang);
  const a = t.account;
  const tabs: { key: Tab; label: string; href: string }[] = [
    { key: "overview", label: a.overview, href: "/account" },
    { key: "workshops", label: a.workshops, href: "/account/workshops" },
    { key: "orders", label: a.orders, href: "/account/orders" },
    { key: "profile", label: a.profile, href: "/account/profile" },
  ];
  const initials = customer.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <>
      <section className="bg-brand-soft">
        <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-dark text-lg font-semibold text-white" aria-hidden="true">{initials}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">{t.auth.accountTitle}</p>
              <h1 className="truncate text-3xl font-bold sm:text-4xl">{a.hello(customer.name)}</h1>
            </div>
            <form action={logoutCustomer.bind(null, lang)}>
              <button type="submit" className="min-h-10 rounded-full border border-brand-dark/25 bg-white/70 px-5 text-sm text-muted transition hover:bg-white hover:text-ink">{t.auth.logout}</button>
            </form>
          </div>
          <nav aria-label={t.auth.accountTitle} className="-mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex w-max gap-1 sm:w-auto">
              {tabs.map((tab) => {
                const current = tab.key === active;
                return (
                  <li key={tab.key}>
                    <Link
                      href={localizeHref(lang, tab.href)}
                      aria-current={current ? "page" : undefined}
                      className={`flex min-h-12 items-center gap-2 rounded-t-2xl px-5 text-sm font-medium transition-colors ${current ? "bg-white text-brand-dark" : "text-muted hover:bg-white/50 hover:text-ink"}`}
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">{ICONS[tab.key]}</svg>
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</div>
    </>
  );
}

export function EmptyState({ text, action }: { text: string; action?: { label: string; href: string } }) {
  return (
    <div className="rounded-3xl border border-dashed border-line px-6 py-10 text-center">
      <p className="text-muted">{text}</p>
      {action && (
        <Link href={action.href} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand-dark px-6 text-sm text-white transition-colors hover:bg-ink">{action.label}</Link>
      )}
    </div>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: { label: string; href: string } }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="text-2xl font-bold">{title}</h2>
      {action && <Link href={action.href} className="text-sm font-medium text-brand-dark underline-offset-4 hover:underline">{action.label}</Link>}
    </div>
  );
}
