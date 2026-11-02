import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import { getSite } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref } from "@/lib/i18n/config";
import { whatsappDigits, whatsappUrl } from "@/lib/whatsapp";

export async function generateMetadata({ params }: PageProps<"/[lang]/forgot-password">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? getDictionary(lang).auth.forgotTitle : "Forgot password", robots: { index: false, follow: false } };
}

export default async function ForgotPasswordPage({ params }: PageProps<"/[lang]/forgot-password">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const a = getDictionary(lang).auth;
  const site = await getSite();
  const whatsapp = whatsappUrl(whatsappDigits(site), a.forgotMessage);
  const email = site.contact.emails[0];
  return (
    <AuthCard title={a.forgotTitle} intro={a.forgotIntro}>
      <div className="space-y-4 text-center">
        {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center rounded-full bg-brand-dark px-6 font-medium text-white transition hover:bg-ink">{a.forgotButton}</a>}
        {email && <p className="text-sm text-muted">{a.forgotEmail} <a href={`mailto:${email}`} dir="ltr" className="underline underline-offset-4">{email}</a></p>}
        <Link href={localizeHref(lang, "/login")} className="inline-block text-sm font-medium text-brand-dark underline underline-offset-4">{a.backToLogin}</Link>
      </div>
    </AuthCard>
  );
}
