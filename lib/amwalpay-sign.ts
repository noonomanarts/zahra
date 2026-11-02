import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * AmwalPay signatures, as in the company's own plugins (github.com/amwal-pay): HMAC-SHA256 over `key=value&…` with the
 * secret key hex-decoded, upper-case hex. Values the gateway reports as "null" or "undefined" are signed as empty.
 */
export const AMWAL_CURRENCY_OMR = 512;

export const isHexKey = (key: string) => /^[0-9a-fA-F]+$/.test(key) && key.length % 2 === 0;

const hmac = (text: string, hexKey: string) => createHmac("sha256", Buffer.from(hexKey, "hex")).update(text).digest("hex").toUpperCase();

export function signAmwalRequest(p: { amount: string; merchantId: string; merchantReference: string; terminalId: string; dateTime: string }, hexKey: string) {
  return hmac(`Amount=${p.amount}&CurrencyId=${AMWAL_CURRENCY_OMR}&MerchantId=${p.merchantId}&MerchantReference=${p.merchantReference}&RequestDateTime=${p.dateTime}&SessionToken=&TerminalId=${p.terminalId}`, hexKey);
}

/** Signs fields in the order given: the order is part of the signature. */
export function signAmwalFields(fields: [string, unknown][], hexKey: string) {
  const text = fields.map(([k, v]) => `${k}=${v === null || v === undefined || v === "null" || v === "undefined" ? "" : String(v)}`).join("&");
  return hmac(text, hexKey);
}

export function sameAmwalHash(expected: string, received: unknown) {
  const a = Buffer.from(expected.toUpperCase());
  const b = Buffer.from(String(received ?? "").toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Fields of the browser's return to the store. */
export const callbackFields = (q: Record<string, string | undefined>, merchantId: string, terminalId: string): [string, unknown][] => [
  ["amount", q.amount],
  ["currencyId", q.currencyId],
  ["customerId", q.customerId],
  ["customerTokenId", q.customerTokenId],
  ["merchantId", merchantId],
  ["merchantReference", q.merchantReference],
  ["responseCode", q.responseCode],
  ["terminalId", terminalId],
  ["transactionId", q.transactionId],
  ["transactionTime", q.transactionTime],
];

/** Fields of the server-to-server notification. */
export const notificationFields = (b: Record<string, unknown>, merchantId: string, terminalId: string): [string, unknown][] => [
  ["Amount", b.Amount],
  ["AuthorizationDateTime", b.AuthorizationDateTime],
  ["CurrencyId", b.CurrencyId],
  ["DateTimeLocalTrxn", b.DateTimeLocalTrxn],
  ["MerchantId", merchantId],
  ["MerchantReference", b.MerchantReference],
  ["Message", b.Message],
  ["PaidThrough", b.PaidThrough],
  ["ResponseCode", b.ResponseCode],
  ["SystemReference", b.SystemReference],
  ["TerminalId", terminalId],
  ["TxnType", b.TxnType],
];
