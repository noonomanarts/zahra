import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { BANK_MUSCAT_URL, getCurrencySettings } from "@/lib/currency-server";
import { getAdminT } from "@/lib/i18n/admin-server";
import { PageTitle } from "@/components/admin/ui";
import CurrencyPanel from "./CurrencyPanel";

export const metadata: Metadata = { title: "Currencies" };

export default async function CurrenciesPage() {
  await requireAdmin();
  const { t } = await getAdminT();
  const settings = await getCurrencySettings();
  return (
    <>
      <PageTitle title={t.currencies.title} />
      <CurrencyPanel key={`${settings.approvedAt}-${settings.pending?.fetchedAt}`} settings={settings} sourceUrl={BANK_MUSCAT_URL} />
    </>
  );
}
