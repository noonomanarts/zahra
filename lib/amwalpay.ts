import "server-only";
import { AMWAL_CURRENCY_OMR, callbackFields, notificationFields, sameAmwalHash, signAmwalFields, signAmwalRequest } from "./amwalpay-sign";
import { amwalConfig, AMWAL_SCRIPT } from "./payments";
import { toMinorUnits } from "./paymob";

/** YYYYMMDDHHmmss in Muscat time, the gateway's home. */
function gatewayDateTime(date: Date) {
  return new Date(date.getTime() + 4 * 3600_000).toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

/** What the SmartBox script needs to open the payment window for an order. */
export async function amwalCheckout(order: { paymentReference: string; total: number }, lang: "en" | "ar") {
  const config = await amwalConfig();
  const amount = order.total.toFixed(3);
  const dateTime = gatewayDateTime(new Date());
  return {
    script: AMWAL_SCRIPT[config.environment],
    payload: {
      AmountTrxn: amount,
      MerchantReference: order.paymentReference,
      MID: config.merchantId,
      TID: config.terminalId,
      CurrencyId: AMWAL_CURRENCY_OMR,
      LanguageId: lang,
      SecureHash: signAmwalRequest({ amount, merchantId: config.merchantId, merchantReference: order.paymentReference, terminalId: config.terminalId, dateTime }, config.secretKey),
      TrxDateTime: dateTime,
      PaymentViewType: 1,
      RequestSource: "Checkout_Direct_Integration",
      SessionToken: "",
    },
  };
}

const toTransaction = (reference: unknown, transactionId: unknown, responseCode: unknown, amount: unknown) => ({
  reference: String(reference ?? ""),
  transactionId: String(transactionId ?? ""),
  success: String(responseCode) === "00",
  amountMinor: toMinorUnits(Number(amount)),
});

/** The browser's return from the payment window. Trusted only if the signature matches our secret key. */
export async function verifyAmwalCallback(query: Record<string, string | undefined>) {
  const c = await amwalConfig();
  if (!c.secretKey || !query.merchantReference) return null;
  if (!sameAmwalHash(signAmwalFields(callbackFields(query, c.merchantId, c.terminalId), c.secretKey), query.secureHashValue)) return null;
  return toTransaction(query.merchantReference, query.transactionId, query.responseCode, query.amount);
}

/** AmwalPay's server-to-server notification, which still arrives if the customer closes the browser. */
export async function verifyAmwalNotification(body: Record<string, unknown>) {
  const c = await amwalConfig();
  if (!c.secretKey || String(body.MerchantId) !== c.merchantId || String(body.TerminalId) !== c.terminalId) return null;
  if (!sameAmwalHash(signAmwalFields(notificationFields(body, c.merchantId, c.terminalId), c.secretKey), body.SecureHash)) return null;
  return toTransaction(body.MerchantReference, body.SystemReference, body.ResponseCode, body.Amount);
}
