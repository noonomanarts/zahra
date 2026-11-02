import "server-only";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lte, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";

export const CUSTOMER_SESSION_COOKIE = "zds_customer";
const SESSION_DAYS = 30;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type Customer = { id: number; name: string; email: string };

/** Only public account fields leave this data-access layer. */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token || !TOKEN_PATTERN.test(token)) return null;

  const sessionId = hashToken(token);
  const [account] = await db.select({
    id: schema.customers.id,
    name: schema.customers.name,
    email: schema.customers.email,
    disabledAt: schema.customers.disabledAt,
    expiresAt: schema.customerSessions.expiresAt,
  }).from(schema.customerSessions)
    .innerJoin(schema.customers, eq(schema.customers.id, schema.customerSessions.customerId))
    .where(eq(schema.customerSessions.id, sessionId))
    .limit(1);

  if (!account || account.expiresAt <= new Date() || account.disabledAt) {
    await db.delete(schema.customerSessions).where(eq(schema.customerSessions.id, sessionId));
    return null;
  }

  return { id: account.id, name: account.name, email: account.email };
});

export async function requireCustomer(lang: Locale) {
  const customer = await getCustomer();
  if (!customer) redirect(`/${isLocale(lang) ? lang : DEFAULT_LOCALE}/login`);
  return customer;
}

/** Cookie mutations must run in a Server Action or Route Handler. */
export async function clearInvalidCustomerSession() {
  const store = await cookies();
  if (store.has(CUSTOMER_SESSION_COOKIE) && !(await getCustomer())) {
    store.delete(CUSTOMER_SESSION_COOKIE);
  }
}

export async function createCustomerSession(customerId: number) {
  const store = await cookies();
  const previous = store.get(CUSTOMER_SESSION_COOKIE)?.value;
  const expired = lte(schema.customerSessions.expiresAt, new Date());
  // Remove expired sessions and rotate this browser's existing session.
  await db.delete(schema.customerSessions).where(
    previous && TOKEN_PATTERN.test(previous)
      ? or(expired, eq(schema.customerSessions.id, hashToken(previous)))
      : expired,
  );

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(schema.customerSessions).values({ id: hashToken(token), customerId, expiresAt });
  await db.update(schema.customers).set({ lastLoginAt: new Date() }).where(eq(schema.customers.id, customerId));
  store.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Whether a password link can still be used; the page shows the form only then. */
export async function resetTokenValid(token: string) {
  if (!TOKEN_PATTERN.test(token)) return false;
  const row = await db.query.customerPasswordResets.findFirst({
    where: and(eq(schema.customerPasswordResets.id, hashToken(token)), gt(schema.customerPasswordResets.expiresAt, new Date())),
    columns: { id: true },
  });
  return Boolean(row);
}

/** A new one-hour link replaces any earlier one. Returns the raw token, which is never stored. */
export async function createPasswordReset(customerId: number) {
  const token = randomBytes(32).toString("base64url");
  await db.delete(schema.customerPasswordResets).where(eq(schema.customerPasswordResets.customerId, customerId));
  await db.insert(schema.customerPasswordResets).values({ id: hashToken(token), customerId, expiresAt: new Date(Date.now() + 3600_000) });
  return token;
}

export async function destroyCustomerSession() {
  const store = await cookies();
  const token = store.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (token && TOKEN_PATTERN.test(token)) {
    await db.delete(schema.customerSessions).where(eq(schema.customerSessions.id, hashToken(token)));
  }
  store.delete(CUSTOMER_SESSION_COOKIE);
}

type AttemptBucket = { count: number; resetsAt: number };
const attemptWindow = 15 * 60_000;
const maxAttemptBuckets = 2_000;
const authGlobal = globalThis as unknown as { customerAuthAttempts?: Map<string, AttemptBucket> };
const attempts = authGlobal.customerAuthAttempts ??= new Map<string, AttemptBucket>();

/** Bounded, per-process abuse protection; a shared limiter can replace this on multi-instance hosts. */
export async function consumeCustomerAuthAttempt(email: string, purpose: "login" | "register" | "admin-login" | "reset" | "coupon" | "contact") {
  const now = Date.now();
  for (const [key, bucket] of attempts) {
    if (bucket.resetsAt <= now) attempts.delete(key);
  }

  const requestHeaders = await headers();
  const ip = (requestHeaders.get("x-forwarded-for")?.split(",")[0]
    ?? requestHeaders.get("x-real-ip"))?.trim().slice(0, 100);
  // coupon guesses and contact messages are counted per visitor only: a shared count would let one person block the box for everyone
  const limits: [string, number][] = purpose === "coupon" || purpose === "contact" ? [] : [
    [`${purpose}:email:${hashToken(email)}`, purpose === "register" ? 5 : 10],
  ];
  if (ip) limits.push([`${purpose}:ip:${hashToken(ip)}`, purpose === "register" ? 10 : purpose === "contact" ? 5 : 50]);

  const missing = limits.filter(([key]) => !attempts.has(key)).length;
  if (limits.some(([key, limit]) => (attempts.get(key)?.count ?? 0) >= limit)) return false;

  // Expire the oldest unrelated buckets instead of locking out every new account.
  while (attempts.size + missing > maxAttemptBuckets) {
    const oldest = [...attempts.keys()].find((key) => !limits.some(([current]) => current === key));
    if (!oldest) return false;
    attempts.delete(oldest);
  }

  for (const [key] of limits) {
    const bucket = attempts.get(key);
    if (bucket) {
      bucket.count += 1;
      attempts.delete(key);
      attempts.set(key, bucket);
    } else attempts.set(key, { count: 1, resetsAt: now + attemptWindow });
  }
  return true;
}
