import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getSite } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { paymobEnabled } from "@/lib/paymob";
import CheckoutForm from "./CheckoutForm";

export async function generateMetadata({ params }: PageProps<"/[lang]/checkout">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? getDictionary(lang).checkout.title : "Checkout", robots: { index: false } };
}

export default async function CheckoutPage({ params }: PageProps<"/[lang]/checkout">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const site = await getSite();
  return (
    <>
      <PageHeader title={t.checkout.title} lang={lang} crumbs={[{ label: t.cart.title, href: "/cart" }]} />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <CheckoutForm shippingFee={site.shippingFee} paymentOnline={paymobEnabled()} />
      </div>
    </>
  );
}
