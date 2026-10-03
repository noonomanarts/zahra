import type { Metadata } from "next";
import { getAdmin } from "@/lib/auth";
import { dirOf } from "@/lib/i18n/config";
import { getAdminT } from "@/lib/i18n/admin-server";
import AdminI18nProvider from "@/components/admin/AdminI18n";
import AdminNav from "./AdminNav";
import { logout, setAdminLanguage } from "./actions";
import { arefRuqaa, plexArabic } from "../fonts";
import "../globals.css";


export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Zahras Design Studio" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [admin, { lang, t }] = await Promise.all([getAdmin(), getAdminT()]);

  return (
    <html lang={lang} dir={dirOf(lang)} className={`h-full antialiased ${plexArabic.variable} ${arefRuqaa.variable}`}>
      <body className="min-h-full bg-zinc-50 font-sans text-zinc-900">
        <AdminI18nProvider lang={lang}>
          {!admin ? (
            children
          ) : (
            <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
              <aside className="border-b border-zinc-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-e lg:border-b-0">
                <div className="flex h-full flex-col p-4">
                  <p className="px-2 py-3 text-sm font-semibold">Zahras Design Studio</p>
                  <AdminNav />
                  <div className="mt-auto space-y-3 border-t border-zinc-200 pt-4">
                    <form action={setAdminLanguage}>
                      <input type="hidden" name="lang" value={lang === "ar" ? "en" : "ar"} />
                      <button className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50">
                        🌐 {t.nav.switchLanguage}
                      </button>
                    </form>
                    <p className="truncate px-2 text-xs text-zinc-500" dir="ltr">{admin.email}</p>
                    <div className="flex gap-2 px-2 text-sm">
                      <a href={`/${lang}`} target="_blank" className="text-zinc-600 hover:text-zinc-900">{t.nav.viewSite} ↗</a>
                      <form action={logout} className="ms-auto">
                        <button className="text-zinc-600 hover:text-red-700">{t.nav.logout}</button>
                      </form>
                    </div>
                  </div>
                </div>
              </aside>
              <div className="min-w-0 p-4 sm:p-8">{children}</div>
            </div>
          )}
        </AdminI18nProvider>
      </body>
    </html>
  );
}
