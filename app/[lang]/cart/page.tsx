import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import CartView from "./CartView";

export async function generateMetadata({ params }: PageProps<"/[lang]/cart">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? getDictionary(lang).cart.title : "Cart", robots: { index: false } };
}

export default async function CartPage({ params }: PageProps<"/[lang]/cart">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <>
      <PageHeader title={getDictionary(lang).cart.title} lang={lang} />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <CartView />
      </div>
    </>
  );
}
