"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { btnCls, btnSecondaryCls } from "@/components/admin/ui";

const TEXT = {
  en: { title: "This page couldn't load", text: "Nothing was lost. Try again, and if it keeps happening check the server log.", retry: "Try again", home: "Dashboard" },
  ar: { title: "تعذّر تحميل هذه الصفحة", text: "لم يُفقد شيء. حاول مرة أخرى، وإذا تكرر ذلك فراجع سجل الخادم.", retry: "حاول مرة أخرى", home: "لوحة التحكم" },
};

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { lang } = useAdminI18n();
  const t = TEXT[lang];
  useEffect(() => console.error(error), [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <h1 className="font-sans text-xl font-semibold text-zinc-900">{t.title}</h1>
      <p className="mt-2 text-sm text-zinc-500">{t.text}{error.digest && <span className="mt-1 block font-mono text-xs" dir="ltr">{error.digest}</span>}</p>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={() => retry()} className={btnCls}>{t.retry}</button>
        <Link href="/admin" className={btnSecondaryCls}>{t.home}</Link>
      </div>
    </div>
  );
}
