"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";

const TEXT = {
  en: { title: "Something went wrong", text: "Please try again. If it keeps happening, message us on WhatsApp and we will help.", retry: "Try again", home: "Back to the home page" },
  ar: { title: "حدث خطأ ما", text: "يرجى المحاولة مرة أخرى. إذا تكرر ذلك فراسلنا على واتساب وسنساعدك.", retry: "حاول مرة أخرى", home: "العودة إلى الصفحة الرئيسية" },
};

export default function StoreError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { lang, href } = useI18n();
  const t = TEXT[lang];
  useEffect(() => console.error(error), [error]);
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">{t.title}</h1>
      <p className="mt-3 text-muted">{t.text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="min-h-11 rounded-full bg-brand-dark px-6 text-white transition hover:bg-ink">{t.retry}</button>
        <Link href={href("/")} className="inline-flex min-h-11 items-center rounded-full border border-brand-dark/25 px-6 transition hover:bg-brand-soft">{t.home}</Link>
      </div>
    </section>
  );
}
