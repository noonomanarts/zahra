"use client";

import Button from "@/components/Button";
import { useI18n } from "@/components/providers/I18nProvider";

export default function NotFound() {
  const { t, href } = useI18n();
  return (
    <div className="mx-auto max-w-xl px-4 py-32 text-center">
      <p className="font-script text-6xl text-brand">404</p>
      <h1 className="mt-4 text-3xl font-bold">{t.notFound.title}</h1>
      <p className="mt-3 text-muted">{t.notFound.text}</p>
      <div className="mt-8"><Button href={href("/shop")}>{t.notFound.browse}</Button></div>
    </div>
  );
}
