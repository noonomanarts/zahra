"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  clearInvalidCustomerSession,
  consumeCustomerAuthAttempt,
  createCustomerSession,
  destroyCustomerSession,
} from "@/lib/customer-auth";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";
import { hashPassword, verifyPassword } from "@/lib/password";

export type AuthError = "invalidName" | "invalidEmail" | "invalidPassword" | "invalidCredentials"
  | "passwordMismatch" | "registrationFailed" | "rateLimited" | "unavailable";
export type AuthState = { error?: AuthError; name?: string; email?: string };

const dummyPasswordHash = hashPassword("customer-auth-dummy-verification");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const field = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function loginCustomer(lang: Locale, _prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  const state = { email: email.slice(0, 254) };

  try {
    await clearInvalidCustomerSession();
    if (!(await consumeCustomerAuthAttempt(email, "login"))) return { ...state, error: "rateLimited" };
    if (email.length > 254 || !emailPattern.test(email) || password.length < 8 || password.length > 128) {
      return { ...state, error: "invalidCredentials" };
    }

    const customer = await db.query.customers.findFirst({ where: eq(schema.customers.email, email) });
    const matches = await verifyPassword(password, customer?.passwordHash ?? await dummyPasswordHash);
    if (!customer || !matches) return { ...state, error: "invalidCredentials" };
    await createCustomerSession(customer.id);
  } catch {
    return { ...state, error: "unavailable" };
  }

  redirect(`/${isLocale(lang) ? lang : DEFAULT_LOCALE}/account`);
}

export async function registerCustomer(lang: Locale, _prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = field(formData, "name").trim().replace(/\s+/g, " ");
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  const confirmPassword = field(formData, "confirmPassword");
  const state = { name: name.slice(0, 100), email: email.slice(0, 254) };

  try {
    await clearInvalidCustomerSession();
    if (!(await consumeCustomerAuthAttempt(email, "register"))) return { ...state, error: "rateLimited" };
    if (name.length < 2 || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) {
      return { ...state, error: "invalidName" };
    }
    if (email.length > 254 || !emailPattern.test(email)) return { ...state, error: "invalidEmail" };
    if (password.length < 8 || password.length > 128) return { ...state, error: "invalidPassword" };
    if (password !== confirmPassword) return { ...state, error: "passwordMismatch" };

    const passwordHash = await hashPassword(password);
    const [customer] = await db.insert(schema.customers).values({ name, email, passwordHash })
      .onConflictDoNothing({ target: schema.customers.email })
      .returning({ id: schema.customers.id });
    if (!customer) return { ...state, error: "registrationFailed" };
    await createCustomerSession(customer.id);
  } catch {
    return { ...state, error: "unavailable" };
  }

  redirect(`/${isLocale(lang) ? lang : DEFAULT_LOCALE}/account`);
}

export async function logoutCustomer(lang: Locale): Promise<never> {
  await destroyCustomerSession();
  redirect(`/${isLocale(lang) ? lang : DEFAULT_LOCALE}`);
}
