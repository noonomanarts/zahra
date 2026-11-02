import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AccountShell, { SectionTitle } from "@/components/account/AccountShell";
import { requireCustomer } from "@/lib/customer-auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { changeCustomerPassword, saveCustomerDetails } from "../../account-actions";
import { DetailsForm, PasswordForm } from "./ProfileForms";

export async function generateMetadata({ params }: PageProps<"/[lang]/account/profile">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? getDictionary(lang).account.profile : "Profile", robots: { index: false, follow: false } };
}

export default async function ProfilePage({ params }: PageProps<"/[lang]/account/profile">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const customer = await requireCustomer(lang);
  const a = getDictionary(lang).account;
  return (
    <AccountShell lang={lang} customer={customer} active="profile">
      <div className="grid gap-12 lg:grid-cols-2">
        <section><SectionTitle title={a.detailsTitle} /><DetailsForm name={customer.name} email={customer.email} action={saveCustomerDetails.bind(null, lang)} /></section>
        <section><SectionTitle title={a.passwordTitle} /><PasswordForm action={changeCustomerPassword.bind(null, lang)} /></section>
      </div>
    </AccountShell>
  );
}
