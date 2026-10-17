import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import CustomerAuthForm from "@/components/auth/CustomerAuthForm";
import { getCustomer } from "@/lib/customer-auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { loginCustomer } from "../auth-actions";

export async function generateMetadata({ params }: PageProps<"/[lang]/login">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? getDictionary(lang).auth.loginTitle : "Sign in", robots: { index: false, follow: false } };
}

export default async function LoginPage({ params }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  if (await getCustomer()) redirect(`/${lang}/account`);
  const a = getDictionary(lang).auth;
  return <AuthCard title={a.loginTitle} intro={a.loginIntro}><CustomerAuthForm mode="login" submitAction={loginCustomer.bind(null, lang)} /></AuthCard>;
}
