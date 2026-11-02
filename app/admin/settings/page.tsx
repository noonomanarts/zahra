import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSite } from "@/lib/data";
import { getAdminT } from "@/lib/i18n/admin-server";
import { getPrintService } from "@/lib/requests";
import { PageTitle, ReadOnly } from "@/components/admin/ui";
import { SiteSettingsForm } from "./SettingsForms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const admin = await requireAdmin("settings.view");
  const editable = can(admin.permissions, "settings.manage");
  const { t } = await getAdminT();
  const [site, printService] = await Promise.all([getSite(), getPrintService()]);
  return (
    <>
      <PageTitle title={t.settings.title} />
      <div className="space-y-6">
        <ReadOnly when={!editable} label={t.common.readOnly}><SiteSettingsForm site={site} printService={printService} /></ReadOnly>
      </div>
    </>
  );
}
