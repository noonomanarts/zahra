import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import { requireCustomer } from "@/lib/customer-auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { logoutCustomer } from "../auth-actions";

export async function generateMetadata({ params }: PageProps<"/[lang]/account">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? getDictionary(lang).auth.accountTitle : "My account", robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const customer = await requireCustomer(lang);
  const a = getDictionary(lang).auth;
  return (
    <AuthCard title={a.accountTitle} intro={a.accountIntro}>
      <dl className="space-y-5 rounded-2xl bg-brand-soft/60 p-5">
        <div><dt className="text-xs text-muted">{a.name}</dt><dd className="mt-1 break-words font-medium">{customer.name}</dd></div>
        <div><dt className="text-xs text-muted">{a.email}</dt><dd dir="ltr" className="mt-1 break-all font-medium rtl:text-right">{customer.email}</dd></div>
      </dl>
      <Link href={`/${lang}/shop`} className="mt-7 block rounded-full bg-brand-dark px-6 py-3 text-center font-medium text-white transition hover:bg-ink">{a.continueShopping}</Link>
      <form action={logoutCustomer.bind(null, lang)} className="mt-3">
        <button type="submit" className="w-full rounded-full border border-line px-6 py-3 text-sm text-muted transition hover:bg-brand-soft hover:text-ink">{a.logout}</button>
      </form>
    </AuthCard>
  );
}
