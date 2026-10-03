import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getSite } from "@/lib/data";
import { getAdminT } from "@/lib/i18n/admin-server";
import { paymobEnabled } from "@/lib/paymob";
import { Card, PageTitle } from "@/components/admin/ui";
import { PasswordForm, SiteSettingsForm } from "./SettingsForms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const { t } = await getAdminT();
  const site = await getSite();
  return (
    <>
      <PageTitle title={t.settings.title} />
      <div className="space-y-6">
        <SiteSettingsForm site={site} />
        <Card title={t.settings.payments}>
          <p className="text-sm">
            {t.settings.status}:{" "}
            {paymobEnabled() ? <span className="font-medium text-emerald-700">{t.settings.connected}</span> : <span className="font-medium text-amber-700">{t.settings.notConfigured}</span>}
          </p>
          <p className="mt-2 text-sm text-zinc-500">{t.settings.paymobNote(process.env.APP_URL ?? "https://your-domain")}</p>
        </Card>
        <PasswordForm />
      </div>
    </>
  );
}
