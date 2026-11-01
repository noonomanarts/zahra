import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import CustomerAuthForm from "@/components/auth/CustomerAuthForm";
import { getCustomer } from "@/lib/customer-auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { registerCustomer, safeNext } from "../auth-actions";

export async function generateMetadata({ params }: PageProps<"/[lang]/register">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? getDictionary(lang).auth.registerTitle : "Create an account", robots: { index: false, follow: false } };
}

export default async function RegisterPage({ params, searchParams }: PageProps<"/[lang]/register">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const query = (await searchParams).next;
  const next = await safeNext(lang, Array.isArray(query) ? query[0] : query);
  if (await getCustomer()) redirect(next);
  const a = getDictionary(lang).auth;
  return <AuthCard title={a.registerTitle} intro={a.registerIntro}><CustomerAuthForm mode="register" next={next.endsWith("/account") ? undefined : next} submitAction={registerCustomer.bind(null, lang)} /></AuthCard>;
}
