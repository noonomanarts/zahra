"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Drawer } from "@animate-ui/react/primitives/radix-ui";
import { Highlight, HighlightItem } from "@animate-ui/react/primitives/effects/highlight";
import type { Permission } from "@/lib/permissions";
import { useAdminI18n } from "./AdminI18n";
import { Icon, type IconName } from "./icons";
import NotificationBell, { NotificationProvider } from "./NotificationBell";
import { Tip } from "./motion";

type NavKey = "dashboard" | "orders" | "requests" | "finance" | "products" | "workshops" | "categories" | "tags" | "pages" | "currencies" | "settings" | "users" | "customers" | "account" | "forbidden" | "search" | "coupons" | "reviews" | "payments" | "email" | "notifications";
type NavItem = { href: string; key: NavKey; icon: IconName; needs?: Permission };

const GROUPS: { key: "overview" | "sales" | "catalogue" | "people" | "site"; items: NavItem[] }[] = [
  { key: "overview", items: [{ href: "/admin", key: "dashboard", icon: "dashboard" }] },
  {
    key: "sales",
    items: [
      { href: "/admin/orders", key: "orders", icon: "orders", needs: "orders.view" },
      { href: "/admin/requests", key: "requests", icon: "requests", needs: "requests.view" },
      { href: "/admin/finance", key: "finance", icon: "finance", needs: "finance.view" },
      { href: "/admin/coupons", key: "coupons", icon: "ticket", needs: "coupons.view" },
    ],
  },
  {
    key: "catalogue",
    items: [
      { href: "/admin/products", key: "products", icon: "products", needs: "products.view" },
      { href: "/admin/workshops", key: "workshops", icon: "workshops", needs: "workshops.view" },
      { href: "/admin/categories", key: "categories", icon: "categories", needs: "taxonomy.view" },
      { href: "/admin/tags", key: "tags", icon: "tags", needs: "taxonomy.view" },
      { href: "/admin/reviews", key: "reviews", icon: "star", needs: "reviews.view" },
    ],
  },
  {
    key: "people",
    items: [
      { href: "/admin/customers", key: "customers", icon: "users", needs: "customers.view" },
      { href: "/admin/users", key: "users", icon: "shield", needs: "users.view" },
    ],
  },
  {
    key: "site",
    items: [
      { href: "/admin/pages", key: "pages", icon: "pages", needs: "pages.view" },
      { href: "/admin/currencies", key: "currencies", icon: "currencies", needs: "currencies.view" },
      { href: "/admin/payments", key: "payments", icon: "card", needs: "payments.view" },
      { href: "/admin/email", key: "email", icon: "mail", needs: "email.view" },
      { href: "/admin/settings", key: "settings", icon: "settings", needs: "settings.view" },
    ],
  },
];

/** Pages outside the menu, named in the top bar on small screens. */
const OTHER: NavItem[] = [
  { href: "/admin/account", key: "account", icon: "settings" },
  { href: "/admin/forbidden", key: "forbidden", icon: "ban" },
  { href: "/admin/search", key: "search", icon: "search" },
  { href: "/admin/notifications", key: "notifications", icon: "bell" },
];

const spring = { type: "spring", stiffness: 380, damping: 34 } as const;

function Brand({ name }: { name: string }) {
  const { t } = useAdminI18n();
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-1.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark font-script text-xl text-white shadow-sm shadow-brand/30" aria-hidden="true">
        Z
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold text-zinc-900">{name}</span>
        <span className="block text-xs text-zinc-500">{t.nav.panel}</span>
      </span>
    </Link>
  );
}

/**
 * Grouped navigation; a soft brand pill slides to the current page (Animate UI Highlight).
 * The current item keeps dark text, so it stays readable while the pill is still moving or not drawn yet.
 */
function Nav({ active, newRequests, permissions, onNavigate }: { active: string; newRequests: number; permissions: Permission[]; onNavigate?: () => void }) {
  const { t } = useAdminI18n();
  // the menu only hides what the server refuses anyway
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.needs || permissions.includes(i.needs)) })).filter((g) => g.items.length);
  return (
    <nav aria-label={t.nav.panel}>
      <Highlight controlledItems value={active} transition={spring} className="inset-0 rounded-lg bg-brand-soft shadow-[inset_0_0_0_1px_rgba(164,110,98,0.18)]">
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.key}>
              {group.key !== "overview" && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase rtl:tracking-normal">{t.nav.groups[group.key]}</p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const current = item.href === active;
                  return (
                    <li key={item.href}>
                      <HighlightItem value={item.href}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={current ? "page" : undefined}
                          className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${
                            current ? "font-semibold text-brand-ink" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                          }`}
                        >
                          <Icon name={item.icon} className={current ? "text-brand-ink" : "text-zinc-400 transition-colors group-hover:text-zinc-700"} />
                          <span className="flex-1">{t.nav[item.key]}</span>
                          {item.key === "requests" && newRequests > 0 && (
                            <span className={`grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] leading-5 font-semibold bg-brand-dark text-white`}>
                              {newRequests}
                            </span>
                          )}
                        </Link>
                      </HighlightItem>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Highlight>
    </nav>
  );
}

/** Finds orders, customers, products and more; results follow the user's access. */
function SearchBox() {
  const { t } = useAdminI18n();
  return (
    <form action="/admin/search" role="search" className="relative">
      <Icon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-zinc-400" />
      <input type="search" name="q" required aria-label={t.search.label} placeholder={t.search.placeholder} className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 ps-9 pe-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:ring-4 focus:ring-zinc-900/5" />
    </form>
  );
}

function SidebarFooter({ email, logout, setLanguage }: { email: string; logout: () => Promise<void>; setLanguage: (data: FormData) => Promise<void> }) {
  const { lang, t } = useAdminI18n();
  return (
    <div className="space-y-3 border-t border-zinc-200/80 pt-4">
      <div className="grid grid-cols-2 gap-2">
        <form action={setLanguage}>
          <input type="hidden" name="lang" value={lang === "ar" ? "en" : "ar"} />
          <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50">
            <Icon name="globe" size={15} /> {t.nav.switchLanguage}
          </button>
        </form>
        <a href={`/${lang}`} target="_blank" rel="noopener" className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50">
          <Icon name="external" size={15} className="rtl:-scale-x-100" /> {t.nav.viewSite}
        </a>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-2.5 ring-1 ring-zinc-200/60">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-xs font-semibold text-white uppercase" aria-hidden="true">
          {email.slice(0, 1)}
        </span>
        <Link href="/admin/account" aria-label={t.nav.account} className="min-w-0 flex-1 truncate rounded text-xs text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline" dir="ltr">{email}</Link>
        <form action={logout}>
          <Tip label={t.nav.logout}>
            <button aria-label={t.nav.logout} className="grid size-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-red-50 hover:text-red-600">
              <Icon name="logout" size={16} className="rtl:-scale-x-100" />
            </button>
          </Tip>
        </form>
      </div>
    </div>
  );
}

export default function AdminShell({
  name,
  email,
  permissions,
  unreadNotifications,
  newRequests,
  logout,
  setLanguage,
  children,
}: {
  name: string;
  email: string;
  permissions: Permission[];
  unreadNotifications: number;
  newRequests: number;
  logout: () => Promise<void>;
  setLanguage: (data: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  const { lang, t } = useAdminI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const all = [...GROUPS.flatMap((g) => g.items), ...OTHER];
  const current = all.filter((i) => (i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href))).at(-1) ?? all[0];

  // eslint-disable-next-line react-hooks/set-state-in-effect -- the mobile menu closes after navigating
  useEffect(() => setOpen(false), [pathname]);

  // The desktop scroll container persists across routes; start each new page at its heading.
  useEffect(() => {
    if (!window.location.hash) mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  const live = permissions.length > 0;

  return (
    <NotificationProvider initialUnread={unreadNotifications} enabled={live}>
    <div className="min-h-screen lg:grid lg:h-dvh lg:min-h-0 lg:grid-cols-[272px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
      <aside className="hidden border-e border-zinc-200/80 bg-white lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
        <div className="shrink-0 space-y-3 p-4 pb-2"><div className="flex items-center justify-between gap-1"><Brand name={name} />{live && <NotificationBell />}</div>{live && <SearchBox />}</div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"><Nav active={current.href} newRequests={newRequests} permissions={permissions} /></div>
        <div className="shrink-0 p-4 pt-0"><SidebarFooter email={email} logout={logout} setLanguage={setLanguage} /></div>
      </aside>

      {/* small screens: top bar + slide-in drawer */}
      <Drawer.Root open={open} onOpenChange={setOpen} direction={lang === "ar" ? "right" : "left"}>
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200/80 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <Drawer.Trigger aria-label={t.nav.openMenu} className="grid size-10 place-items-center rounded-lg border border-zinc-200 text-zinc-700 transition outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-900">
            <Icon name="menu" />
          </Drawer.Trigger>
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-900">
            <Icon name={current.icon} className="shrink-0 text-zinc-400" />
            <span className="truncate">{t.nav[current.key]}</span>
          </span>
          {live && <span className="ms-auto"><NotificationBell /></span>}
          {newRequests > 0 && current.key !== "requests" && (
            <Link href="/admin/requests?status=new" className="flex items-center gap-1.5 rounded-full bg-brand-dark px-2.5 py-1 text-xs font-semibold text-white">
              <Icon name="requests" size={14} /> {newRequests}
            </Link>
          )}
        </header>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-zinc-950/40 lg:hidden" />
          <Drawer.Content dir={lang === "ar" ? "rtl" : "ltr"} className="fixed inset-y-0 start-0 z-50 flex w-[86vw] max-w-[300px] flex-col bg-white shadow-2xl outline-none lg:hidden">
            <Drawer.Title className="sr-only">{t.nav.panel}</Drawer.Title>
            <div className="flex items-center justify-between gap-2 p-4 pb-2">
              <Brand name={name} />
              <Drawer.Close aria-label={t.nav.closeMenu} className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100">
                <Icon name="close" />
              </Drawer.Close>
            </div>
            {permissions.length > 0 && <div className="px-4 pb-1"><SearchBox /></div>}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"><Nav active={current.href} newRequests={newRequests} permissions={permissions} onNavigate={() => setOpen(false)} /></div>
            <div className="shrink-0 p-4 pt-0"><SidebarFooter email={email} logout={logout} setLanguage={setLanguage} /></div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <main ref={mainRef} tabIndex={0} aria-label={t.nav[current.key]} className="min-w-0 px-4 py-6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-8 sm:py-8 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain xl:px-10">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </div>
    </NotificationProvider>
  );
}
