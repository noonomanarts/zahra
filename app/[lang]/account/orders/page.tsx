import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AccountShell, { EmptyState } from "@/components/account/AccountShell";
import { OrderList } from "@/components/account/OrderList";
import { customerOrders } from "@/lib/account";
import { requireCustomer } from "@/lib/customer-auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref } from "@/lib/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/account/orders">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? getDictionary(lang).account.orders : "Orders", robots: { index: false, follow: false } };
}

export default async function AccountOrdersPage({ params }: PageProps<"/[lang]/account/orders">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const customer = await requireCustomer(lang);
  const t = getDictionary(lang);
  const orders = await customerOrders(customer.id);
  return (
    <AccountShell lang={lang} customer={customer} active="orders">
      {orders.length ? <OrderList lang={lang} orders={orders} /> : <EmptyState text={t.account.noOrders} action={{ label: t.auth.continueShopping, href: localizeHref(lang, "/shop") }} />}
    </AccountShell>
  );
}
