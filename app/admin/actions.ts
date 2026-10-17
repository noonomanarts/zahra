"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession, destroySession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { ADMIN_LOCALE_COOKIE } from "@/lib/i18n/admin";
import { getAdminT } from "@/lib/i18n/admin-server";
import { isLocale } from "@/lib/i18n/config";

export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { t } = await getAdminT();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = email ? await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.email, email) }) : undefined;
  // same message for unknown email and wrong password
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: t.login.invalid, email };
  }
  await createSession(user.id);
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

export async function setAdminLanguage(formData: FormData) {
  const lang = String(formData.get("lang"));
  if (isLocale(lang)) {
    (await cookies()).set(ADMIN_LOCALE_COOKIE, lang, { path: "/admin", maxAge: 31536000, sameSite: "lax" });
  }
  revalidatePath("/admin", "layout");
}
