import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { BANK_MUSCAT_URL, getCurrencySettings } from "@/lib/currency-server";
import { getAdminT } from "@/lib/i18n/admin-server";
import { PageTitle, ReadOnly } from "@/components/admin/ui";
import CurrencyPanel from "./CurrencyPanel";

export const metadata: Metadata = { title: "Currencies" };

export default async function CurrenciesPage() {
  const admin = await requireAdmin("currencies.view");
  const editable = can(admin.permissions, "currencies.manage");
  const { t } = await getAdminT();
  const settings = await getCurrencySettings();
  return (
    <>
      <PageTitle title={t.currencies.title} />
      <ReadOnly when={!editable} label={t.common.readOnly}><CurrencyPanel key={`${settings.approvedAt}-${settings.pending?.fetchedAt}`} settings={settings} sourceUrl={BANK_MUSCAT_URL} /></ReadOnly>
    </>
  );
}
