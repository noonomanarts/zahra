import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AccountShell, { EmptyState } from "@/components/account/AccountShell";
import AccountWorkshopCard from "@/components/account/AccountWorkshopCard";
import { accountDate } from "@/components/account/OrderList";
import { requireCustomer } from "@/lib/customer-auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref } from "@/lib/i18n/config";
import { customerWorkshops } from "@/lib/workshops";

export async function generateMetadata({ params }: PageProps<"/[lang]/account/workshops">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? getDictionary(lang).account.workshops : "Online Workshops", robots: { index: false, follow: false } };
}

export default async function AccountWorkshopsPage({ params }: PageProps<"/[lang]/account/workshops">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const customer = await requireCustomer(lang);
  const a = getDictionary(lang).account;
  const workshops = await customerWorkshops(customer.id, lang);
  return (
    <AccountShell lang={lang} customer={customer} active="workshops">
      {workshops.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {workshops.map((w) => <AccountWorkshopCard key={w.id} lang={lang} workshop={w} date={accountDate(lang, w.since)} />)}
        </div>
      ) : (
        <EmptyState text={a.noWorkshops} action={{ label: a.browseWorkshops, href: localizeHref(lang, "/workshops") }} />
      )}
    </AccountShell>
  );
}
