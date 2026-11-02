import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref } from "@/lib/i18n/config";
import { resetTokenValid } from "@/lib/customer-auth";
import { resetCustomerPassword } from "../account-actions";
import { ResetForm } from "../account/profile/ProfileForms";

export async function generateMetadata({ params }: PageProps<"/[lang]/reset-password">): Promise<Metadata> {
  const { lang } = await params;
  // the token is in the address, so it must not travel in a Referer header either
  return { title: isLocale(lang) ? getDictionary(lang).auth.resetTitle : "Reset password", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function ResetPasswordPage({ params, searchParams }: PageProps<"/[lang]/reset-password">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const a = getDictionary(lang).auth;
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  if (!(await resetTokenValid(token))) {
    return (
      <AuthCard title={a.resetInvalidTitle} intro={a.resetInvalidIntro}>
        <Link href={localizeHref(lang, "/forgot-password")} className="font-medium text-brand-dark underline underline-offset-4">{a.forgotPassword}</Link>
      </AuthCard>
    );
  }
  return <AuthCard title={a.resetTitle} intro={a.resetIntro}><ResetForm token={token} action={resetCustomerPassword.bind(null, lang)} /></AuthCard>;
}
