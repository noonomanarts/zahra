import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { isHexKey } from "./amwalpay-sign";
import { decryptSecret } from "./secrets";

export const GATEWAYS = ["paymob", "amwalpay"] as const;
export type Gateway = (typeof GATEWAYS)[number];
export const AMWAL_ENVIRONMENTS = ["prod", "uat", "sit"] as const;
export type AmwalEnvironment = (typeof AMWAL_ENVIRONMENTS)[number];

/** What is stored under the "payments" setting; the *Secret and *Key fields are encrypted. */
export type StoredPayments = {
  active: Gateway | "none";
  paymob: { publicKey: string; secretKey: string; hmacSecret: string; integrationIds: string; apiUrl: string; checkoutUrl: string };
  amwalpay: { environment: AmwalEnvironment; merchantId: string; terminalId: string; secretKey: string };
};

export async function loadStoredPayments(): Promise<Partial<StoredPayments> | null> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, "payments") });
  return (row?.value as Partial<StoredPayments> | undefined) ?? null;
}

const clean = (value: string | null | undefined) => (value ?? "").trim();

/** Keys saved in the admin win; anything not saved falls back to the PAYMOB_* environment variables. */
export async function paymobConfig(stored?: Partial<StoredPayments> | null) {
  const p = (stored === undefined ? await loadStoredPayments() : stored)?.paymob;
  return {
    apiUrl: clean(p?.apiUrl) || process.env.PAYMOB_API_URL || "https://oman.paymob.com",
    checkoutUrl: clean(p?.checkoutUrl) || process.env.PAYMOB_CHECKOUT_URL || "https://om.checkout.paymob.com",
    secretKey: decryptSecret(p?.secretKey) ?? process.env.PAYMOB_SECRET_KEY ?? "",
    publicKey: clean(p?.publicKey) || process.env.PAYMOB_PUBLIC_KEY || "",
    hmacSecret: decryptSecret(p?.hmacSecret) ?? process.env.PAYMOB_HMAC_SECRET ?? "",
    integrationIds: (clean(p?.integrationIds) || process.env.PAYMOB_INTEGRATION_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (/^\d+$/.test(s) ? Number(s) : s)),
  };
}

export async function amwalConfig(stored?: Partial<StoredPayments> | null) {
  const a = (stored === undefined ? await loadStoredPayments() : stored)?.amwalpay;
  return {
    environment: (a?.environment ?? "uat") as AmwalEnvironment,
    merchantId: clean(a?.merchantId),
    terminalId: clean(a?.terminalId),
    secretKey: decryptSecret(a?.secretKey) ?? "",
  };
}

export const paymobReady = (c: Awaited<ReturnType<typeof paymobConfig>>) => Boolean(c.secretKey && c.publicKey && c.hmacSecret && c.integrationIds.length);
export const amwalReady = (c: Awaited<ReturnType<typeof amwalConfig>>) => Boolean(c.merchantId && c.terminalId && isHexKey(c.secretKey));

export const AMWAL_SCRIPT: Record<AmwalEnvironment, string> = {
  prod: "https://checkout.amwalpg.com/js/SmartBox.js?v=1.1",
  uat: "https://test.amwalpg.com:7443/js/SmartBox.js?v=1.1",
  sit: "https://test.amwalpg.com:19443/js/SmartBox.js?v=1.1",
};

/** The gateway taking payments now, or null when orders are placed without online payment. */
export async function activeGateway(): Promise<Gateway | null> {
  const stored = await loadStoredPayments();
  // before anything is saved in the admin, a server with PAYMOB_* variables keeps working as it did
  const choice = stored?.active ?? "paymob";
  if (choice === "paymob") return paymobReady(await paymobConfig(stored)) ? "paymob" : null;
  if (choice === "amwalpay") return amwalReady(await amwalConfig(stored)) ? "amwalpay" : null;
  return null;
}

/** Test environments take test cards, so a live shop must never stay on one unnoticed. */
export async function amwalTestMode() {
  const stored = await loadStoredPayments();
  return stored?.active === "amwalpay" && (stored.amwalpay?.environment ?? "uat") !== "prod";
}
