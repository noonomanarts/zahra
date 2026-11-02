import type { Metadata } from "next";
import { count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getAdmin } from "@/lib/auth";
import { unreadCount } from "@/lib/admin-notifications";
import { can, permissionList } from "@/lib/permissions";
import { dirOf } from "@/lib/i18n/config";
import { getAdminT } from "@/lib/i18n/admin-server";
import AdminI18nProvider from "@/components/admin/AdminI18n";
import SiteDocument from "@/app/SiteDocument";
import AdminShell from "@/components/admin/AdminShell";
import { logout, setAdminLanguage } from "./actions";
import { arefRuqaa, plexArabic } from "../fonts";
import "../globals.css";


export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Zahras Design Studio" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [admin, { lang }] = await Promise.all([getAdmin(), getAdminT()]);
  const [fresh] = admin && !admin.mustChangePassword && can(admin.permissions, "requests.view")
    ? await db.select({ n: count() }).from(schema.serviceRequests).where(eq(schema.serviceRequests.status, "new"))
    : [{ n: 0 }];

  const unreadNotifications = admin && !admin.mustChangePassword ? await unreadCount(admin) : 0;

  return (
    <SiteDocument showCredit={false} lang={lang} dir={dirOf(lang)} className={`h-full antialiased ${plexArabic.variable} ${arefRuqaa.variable}`}>
      <body className="min-h-full bg-[#f7f6f5] font-sans text-zinc-900 antialiased">
        <AdminI18nProvider lang={lang}>
          {!admin ? (
            children
          ) : (
            <AdminShell name="Zahras Design Studio" email={admin.email} permissions={admin.mustChangePassword ? [] : permissionList(admin.permissions)} unreadNotifications={unreadNotifications} newRequests={fresh.n} logout={logout} setLanguage={setAdminLanguage}>
              {children}
            </AdminShell>
          )}
        </AdminI18nProvider>
      </body>
    </SiteDocument>
  );
}
