import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Paymob Unified Intention API (Oman): https://developers.paymob.com/paymob-docs/developers/intention-apis/create-intention
const config = {
  apiUrl: process.env.PAYMOB_API_URL ?? "https://oman.paymob.com",
  checkoutUrl: process.env.PAYMOB_CHECKOUT_URL ?? "https://om.checkout.paymob.com",
  secretKey: process.env.PAYMOB_SECRET_KEY ?? "",
  publicKey: process.env.PAYMOB_PUBLIC_KEY ?? "",
  hmacSecret: process.env.PAYMOB_HMAC_SECRET ?? "",
  integrationIds: (process.env.PAYMOB_INTEGRATION_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s)),
  // amounts are sent in the smallest currency unit (OMR: 1 rial = 1000 baisa)
  multiplier: Number(process.env.PAYMOB_AMOUNT_MULTIPLIER ?? 1000),
};

export const paymobEnabled = () =>
  !!(config.secretKey && config.publicKey && config.hmacSecret && config.integrationIds.length);

export const toMinorUnits = (amount: number) => Math.round(amount * config.multiplier);

type IntentionInput = {
  reference: string;
  currency: string;
  total: number;
  items: { name: string; unitPrice: number; quantity: number }[];
  customer: { name: string; email: string; phone: string; country?: string | null; city?: string | null; address?: string | null };
  appUrl: string;
  /** where Paymob sends the customer back (localized result page) */
  returnUrl: string;
};

export async function createIntention(input: IntentionInput) {
  const [firstName, ...rest] = input.customer.name.trim().split(/\s+/);
  const res = await fetch(`${config.apiUrl}/v1/intention/`, {
    method: "POST",
    headers: { Authorization: `Token ${config.secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: toMinorUnits(input.total),
      currency: input.currency,
      payment_methods: config.integrationIds,
      items: input.items.map((i) => ({ name: i.name.slice(0, 50), amount: toMinorUnits(i.unitPrice), quantity: i.quantity })),
      billing_data: {
        first_name: firstName || "NA",
        last_name: rest.join(" ") || "NA",
        email: input.customer.email,
        phone_number: input.customer.phone,
        country: input.customer.country || "NA",
        city: input.customer.city || "NA",
        street: input.customer.address || "NA",
        building: "NA",
        floor: "NA",
        apartment: "NA",
        state: "NA",
      },
      special_reference: input.reference,
      notification_url: `${input.appUrl}/api/paymob/webhook`,
      redirection_url: input.returnUrl,
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.client_secret) {
    throw new Error(`Paymob intention failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  return {
    intentionId: String(data.id),
    paymobOrderId: data.intention_order_id ? String(data.intention_order_id) : null,
    checkoutUrl: `${config.checkoutUrl}/?publicKey=${encodeURIComponent(config.publicKey)}&clientSecret=${encodeURIComponent(data.client_secret)}`,
  };
}

// ---------- HMAC (https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-transaction-callback) ----------

const HMAC_KEYS = [
  "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "id", "integration_id",
  "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment", "is_voided", "order", "owner",
  "pending", "source_data.pan", "source_data.sub_type", "source_data.type", "success",
] as const;

function sign(values: string[]) {
  return createHmac("sha512", config.hmacSecret).update(values.join("")).digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a.toLowerCase());
  const y = Buffer.from(b.toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** The `obj` of a transaction callback (only the fields we read). */
type PaymobTransactionObj = {
  [key: string]: unknown;
  order?: { id?: unknown; merchant_order_id?: unknown };
  source_data?: Record<string, unknown>;
};

export type PaymobTransaction = {
  transactionId: string;
  paymobOrderId: string;
  reference: string | null;
  success: boolean;
  pending: boolean;
  amountMinor: number;
};

/** Transaction processed callback (POST webhook): body `{ type, obj }`, signature in `?hmac=`. */
export function verifyProcessedCallback(obj: PaymobTransactionObj, hmac: string): PaymobTransaction | null {
  const values = HMAC_KEYS.map((k) =>
    k === "order" ? str(obj.order?.id) : k.startsWith("source_data.") ? str(obj.source_data?.[k.slice(12)]) : str(obj[k]),
  );
  if (!config.hmacSecret || !hmac || !safeEqual(sign(values), hmac)) return null;
  return {
    transactionId: str(obj.id),
    paymobOrderId: str(obj.order?.id),
    reference: obj.order?.merchant_order_id ? str(obj.order.merchant_order_id) : null,
    success: obj.success === true,
    pending: obj.pending === true,
    amountMinor: Number(obj.amount_cents),
  };
}

/** Transaction response callback (GET redirect back to the store): flat query params incl. `hmac`. */
export function verifyResponseCallback(query: Record<string, string | undefined>): PaymobTransaction | null {
  const values = HMAC_KEYS.map((k) => (k === "order" ? str(query.order ?? query.order_id) : str(query[k])));
  if (!config.hmacSecret || !query.hmac || !safeEqual(sign(values), query.hmac)) return null;
  return {
    transactionId: str(query.id),
    paymobOrderId: str(query.order ?? query.order_id),
    reference: query.merchant_order_id ?? null,
    success: query.success === "true",
    pending: query.pending === "true",
    amountMinor: Number(query.amount_cents),
  };
}
