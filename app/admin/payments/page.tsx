import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { activeGateway, amwalConfig, amwalReady, amwalTestMode, loadStoredPayments, paymobConfig, paymobReady } from "@/lib/payments";
import { can } from "@/lib/permissions";
import { decryptSecret } from "@/lib/secrets";
import { Notice, PageTitle, ReadOnly } from "@/components/admin/ui";
import PaymentForm, { type PaymentView } from "./PaymentForm";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const admin = await requireAdmin("payments.view");
  const { t } = await getAdminT();
  const p = t.payments;
  const stored = await loadStoredPayments();
  const [paymob, amwal, gateway, testMode] = await Promise.all([paymobConfig(stored), amwalConfig(stored), activeGateway(), amwalTestMode()]);
  const base = process.env.APP_URL ?? "https://your-domain";
  const unreadable = Boolean((stored?.amwalpay?.secretKey && !decryptSecret(stored.amwalpay.secretKey)) || (stored?.paymob?.secretKey && !decryptSecret(stored.paymob.secretKey)));
  // only flags leave the server: a saved secret is never sent to the browser, not even masked
  const view: PaymentView = {
    active: stored?.active ?? (paymobReady(paymob) ? "paymob" : "none"),
    paymob: {
      publicKey: stored?.paymob?.publicKey ?? "",
      integrationIds: stored?.paymob?.integrationIds ?? "",
      apiUrl: stored?.paymob?.apiUrl ?? "",
      checkoutUrl: stored?.paymob?.checkoutUrl ?? "",
      hasSecret: Boolean(paymob.secretKey),
      hasHmac: Boolean(paymob.hmacSecret),
      ready: paymobReady(paymob),
      fromEnv: !stored?.paymob && paymobReady(paymob),
    },
    amwalpay: { environment: amwal.environment, merchantId: amwal.merchantId, terminalId: amwal.terminalId, hasSecret: Boolean(amwal.secretKey), ready: amwalReady(amwal) },
    urls: { paymobWebhook: `${base}/api/paymob/webhook`, amwalWebhook: `${base}/api/amwalpay/webhook` },
  };
  return (
    <>
      <PageTitle title={p.title} description={p.subtitle} />
      <div className="mb-6 space-y-3 empty:hidden">
        {!gateway && <Notice>{p.offlineWarning}</Notice>}
        {testMode && <Notice>{p.testModeWarning}</Notice>}
        {unreadable && <Notice>{p.unreadable}</Notice>}
      </div>
      <ReadOnly when={!can(admin.permissions, "payments.manage")} label={t.common.readOnly}><PaymentForm view={view} /></ReadOnly>
    </>
  );
}
