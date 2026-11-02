"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { isHexKey } from "@/lib/amwalpay-sign";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { AMWAL_ENVIRONMENTS, amwalConfig, amwalReady, loadStoredPayments, paymobConfig, paymobReady, type AmwalEnvironment, type Gateway, type StoredPayments } from "@/lib/payments";
import { revalidateSite } from "@/lib/revalidate";
import { encryptSecret } from "@/lib/secrets";

export type PaymentState = { error?: string; ok?: string };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim().slice(0, 500);

/** Saves the chosen gateway and its keys. A secret left empty keeps the saved one; secrets are never sent back. */
export async function savePayments(_prev: PaymentState, formData: FormData): Promise<PaymentState> {
  const admin = await requireAdmin("payments.manage");
  const { t } = await getAdminT();
  const e = t.payments.errors;
  const current = (await loadStoredPayments()) ?? {};
  const chosen = String(formData.get("active"));
  const active: Gateway | "none" = chosen === "paymob" || chosen === "amwalpay" ? chosen : "none";

  const environment = String(formData.get("amwal_environment"));
  const amwalSecret = text(formData, "amwal_secretKey");
  if (amwalSecret && !isHexKey(amwalSecret)) return { error: e.amwalKey };
  const paymobSecret = text(formData, "paymob_secretKey");
  const paymobHmac = text(formData, "paymob_hmacSecret");

  const next: StoredPayments = {
    active,
    paymob: {
      publicKey: text(formData, "paymob_publicKey"),
      integrationIds: text(formData, "paymob_integrationIds"),
      apiUrl: text(formData, "paymob_apiUrl"),
      checkoutUrl: text(formData, "paymob_checkoutUrl"),
      secretKey: paymobSecret ? encryptSecret(paymobSecret) : current.paymob?.secretKey ?? "",
      hmacSecret: paymobHmac ? encryptSecret(paymobHmac) : current.paymob?.hmacSecret ?? "",
    },
    amwalpay: {
      environment: (AMWAL_ENVIRONMENTS as readonly string[]).includes(environment) ? (environment as AmwalEnvironment) : "uat",
      merchantId: text(formData, "amwal_merchantId"),
      terminalId: text(formData, "amwal_terminalId"),
      secretKey: amwalSecret ? encryptSecret(amwalSecret) : current.amwalpay?.secretKey ?? "",
    },
  };

  // a gateway missing a key would break checkout for every customer, so it can't be switched on
  if (active === "paymob" && !paymobReady(await paymobConfig(next))) return { error: e.paymobIncomplete };
  if (active === "amwalpay" && !amwalReady(await amwalConfig(next))) return { error: e.amwalIncomplete };

  await db.insert(schema.settings).values({ key: "payments", value: next }).onConflictDoUpdate({ target: schema.settings.key, set: { value: next } });
  // only which gateway and environment: never a key
  await audit(admin, "payments.saved", { type: "payments", label: active === "amwalpay" ? `amwalpay (${next.amwalpay.environment})` : active });
  revalidateSite();
  revalidatePath("/admin", "layout");
  return { ok: t.payments.saved };
}
