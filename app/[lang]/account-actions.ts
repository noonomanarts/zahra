"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { and, eq, gt, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { consumeCustomerAuthAttempt, createCustomerSession, getCustomer } from "@/lib/customer-auth";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { AuthError } from "./auth-actions";

export type AccountFormState = { error?: AuthError; saved?: boolean };

const field = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const home = (lang: Locale) => (isLocale(lang) ? lang : DEFAULT_LOCALE);

async function signedIn(lang: Locale) {
  const customer = await getCustomer();
  if (!customer) redirect(`/${home(lang)}/login`);
  const row = await db.query.customers.findFirst({ where: eq(schema.customers.id, customer.id) });
  if (!row) redirect(`/${home(lang)}/login`);
  return row;
}

export async function saveCustomerDetails(lang: Locale, _prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const customer = await signedIn(lang);
  const name = field(formData, "name").trim().replace(/\s+/g, " ");
  const email = field(formData, "email").trim().toLowerCase();
  if (name.length < 2 || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) return { error: "invalidName" };
  if (email.length > 254 || !emailPattern.test(email)) return { error: "invalidEmail" };

  if (email !== customer.email) {
    // the email signs in, so changing it asks for the password even on an open session
    if (!(await consumeCustomerAuthAttempt(customer.email, "login"))) return { error: "rateLimited" };
    if (!(await verifyPassword(field(formData, "current"), customer.passwordHash))) return { error: "wrongPassword" };
    const taken = await db.query.customers.findFirst({ where: and(eq(schema.customers.email, email), ne(schema.customers.id, customer.id)), columns: { id: true } });
    if (taken) return { error: "emailInUse" };
  }
  await db.update(schema.customers).set({ name, email }).where(eq(schema.customers.id, customer.id));
  return { saved: true };
}

export async function changeCustomerPassword(lang: Locale, _prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const customer = await signedIn(lang);
  const next = field(formData, "next");
  if (next.length < 8 || next.length > 128) return { error: "invalidPassword" };
  if (next !== field(formData, "confirm")) return { error: "passwordMismatch" };
  if (!(await consumeCustomerAuthAttempt(customer.email, "login"))) return { error: "rateLimited" };
  if (!(await verifyPassword(field(formData, "current"), customer.passwordHash))) return { error: "wrongPassword" };

  await db.update(schema.customers).set({ passwordHash: await hashPassword(next) }).where(eq(schema.customers.id, customer.id));
  // every other device is signed out; this one continues on a fresh session
  await db.delete(schema.customerSessions).where(eq(schema.customerSessions.customerId, customer.id));
  await db.delete(schema.customerPasswordResets).where(eq(schema.customerPasswordResets.customerId, customer.id));
  await createCustomerSession(customer.id);
  return { saved: true };
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function resetCustomerPassword(lang: Locale, _prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const token = field(formData, "token");
  const next = field(formData, "next");
  if (next.length < 8 || next.length > 128) return { error: "invalidPassword" };
  if (next !== field(formData, "confirm")) return { error: "passwordMismatch" };
  if (!(await consumeCustomerAuthAttempt(hashToken(token), "reset"))) return { error: "rateLimited" };
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { error: "resetInvalid" };

  const passwordHash = await hashPassword(next);
  const done = await db.transaction(async (tx) => {
    // taking the row inside the transaction is what makes the link single-use
    const [used] = await tx.delete(schema.customerPasswordResets).where(and(eq(schema.customerPasswordResets.id, hashToken(token)), gt(schema.customerPasswordResets.expiresAt, new Date()))).returning();
    if (!used) return false;
    await tx.update(schema.customers).set({ passwordHash }).where(eq(schema.customers.id, used.customerId));
    await tx.delete(schema.customerSessions).where(eq(schema.customerSessions.customerId, used.customerId));
    await tx.delete(schema.customerPasswordResets).where(eq(schema.customerPasswordResets.customerId, used.customerId));
    return true;
  });
  if (!done) return { error: "resetInvalid" };
  redirect(`/${home(lang)}/login?reset=1`);
}
