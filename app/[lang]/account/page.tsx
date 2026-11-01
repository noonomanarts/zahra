import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AccountShell, { EmptyState, SectionTitle } from "@/components/account/AccountShell";
import AccountWorkshopCard from "@/components/account/AccountWorkshopCard";
import { OrderList, StatusPill, accountDate } from "@/components/account/OrderList";
import { customerOrders, customerRequests } from "@/lib/account";
import { SERVICE_PATHS } from "@/lib/catalog";
import { requireCustomer } from "@/lib/customer-auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref } from "@/lib/i18n/config";
import { customerWorkshops } from "@/lib/workshops";

export async function generateMetadata({ params }: PageProps<"/[lang]/account">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? getDictionary(lang).auth.accountTitle : "My account", robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const customer = await requireCustomer(lang);
  const t = getDictionary(lang);
  const a = t.account;
  const [workshops, orders, requests] = await Promise.all([
    customerWorkshops(customer.id, lang),
    customerOrders(customer.id, 5),
    customerRequests(customer.id),
  ]);
  const href = (p: string) => localizeHref(lang, p);

  return (
    <AccountShell lang={lang} customer={customer} active="overview">
      <div className="grid gap-12 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-12">
          <section>
            <SectionTitle title={a.myWorkshops} action={workshops.length > 3 ? { label: a.viewAll, href: href("/account/workshops") } : undefined} />
            {workshops.length ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {workshops.slice(0, 3).map((w) => <AccountWorkshopCard key={w.id} lang={lang} workshop={w} date={accountDate(lang, w.since)} />)}
              </div>
            ) : (
              <EmptyState text={a.noWorkshops} action={{ label: a.browseWorkshops, href: href("/workshops") }} />
            )}
          </section>

          <section>
            <SectionTitle title={a.orders} action={orders.length ? { label: a.viewAll, href: href("/account/orders") } : undefined} />
            {orders.length ? <OrderList lang={lang} orders={orders} /> : <EmptyState text={a.noOrders} action={{ label: t.auth.continueShopping, href: href("/shop") }} />}
          </section>

          {requests.length > 0 && (
            <section>
              <SectionTitle title={a.requests} />
              <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
                {requests.map((r) => (
                  <li key={r.number} className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div>
                      <a href={href(SERVICE_PATHS[r.type])} className="font-semibold hover:text-brand-dark">{a.requestTypes[r.type]}</a>
                      <p className="mt-0.5 text-sm text-muted"><span dir="ltr">{r.number}</span> · {accountDate(lang, r.createdAt)}</p>
                    </div>
                    <StatusPill lang={lang} status={r.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="h-fit rounded-3xl bg-brand-soft/60 p-6">
          <h2 className="font-sans text-lg font-semibold">{a.profile}</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div><dt className="text-xs text-muted">{t.auth.name}</dt><dd className="mt-1 font-medium break-words">{customer.name}</dd></div>
            <div><dt className="text-xs text-muted">{t.auth.email}</dt><dd dir="ltr" className="mt-1 font-medium break-all rtl:text-right">{customer.email}</dd></div>
          </dl>
          <a href={href("/shop")} className="mt-6 block rounded-full bg-brand-dark px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-ink">{t.auth.continueShopping}</a>
        </aside>
      </div>
    </AccountShell>
  );
}
