"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit, pruneAuditLog } from "@/lib/audit";
import { createSession, destroySession, getAdmin } from "@/lib/auth";
import { consumeCustomerAuthAttempt } from "@/lib/customer-auth";
import { verifyPassword } from "@/lib/password";
import { ADMIN_LOCALE_COOKIE } from "@/lib/i18n/admin";
import { getAdminT } from "@/lib/i18n/admin-server";
import { isLocale } from "@/lib/i18n/config";

export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { t } = await getAdminT();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!(await consumeCustomerAuthAttempt(email, "admin-login"))) return { error: t.login.rateLimited, email };
  const user = email ? await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.email, email) }) : undefined;
  // same message for unknown email, wrong password and disabled account
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    await audit({ email }, "auth.login_failed");
    return { error: t.login.invalid, email };
  }
  await createSession(user.id);
  await audit({ id: user.id, email: user.email }, "auth.login");
  await pruneAuditLog();
  redirect("/admin");
}

export async function logout() {
  const admin = await getAdmin();
  if (admin) await audit(admin, "auth.logout");
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
