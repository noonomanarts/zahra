import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import RetryButton from "./RetryButton";

export const metadata: Metadata = { robots: { index: false } };

/** Precached by the service worker and shown when a page can't be loaded without a connection. */
export default async function OfflinePage({ params }: PageProps<"/[lang]/offline">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang).pwa;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <svg className="zds-rise" width="160" height="120" viewBox="0 0 160 120" fill="none" aria-hidden="true">
        <circle cx="80" cy="60" r="52" stroke="var(--color-header)" strokeWidth="3" strokeDasharray="10 7" className="zds-stitch" />
        <path d="M48 66c9-11 20-17 32-17s23 6 32 17" stroke="var(--color-brand)" strokeWidth="4" strokeLinecap="round" />
        <path d="M60 78c5-6 12-9 20-9s15 3 20 9" stroke="var(--color-brand)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="80" cy="90" r="4" fill="var(--color-brand)" />
        <path d="M44 34l72 60" stroke="var(--color-brand-dark)" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <h1 className="zds-rise mt-8 text-4xl font-bold" style={{ animationDelay: "120ms" }}>{t.offlineTitle}</h1>
      <p className="zds-rise mt-3 text-muted" style={{ animationDelay: "240ms" }}>{t.offlineText}</p>
      <div className="zds-rise mt-8" style={{ animationDelay: "360ms" }}>
        <RetryButton label={t.retry} />
      </div>
    </div>
  );
}
