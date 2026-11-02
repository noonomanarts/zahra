"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { currentSessionId, requireSession, revokeSessions } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { hashPassword, verifyPassword } from "@/lib/password";
import { cleanName, validEmail, validName } from "@/components/admin/people";

export type AccountState = { error?: string; ok?: string };

export async function saveProfile(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const admin = await requireSession();
  const { t } = await getAdminT();
  const e = t.people.errors;
  const name = cleanName(formData.get("name"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!validName(name)) return { error: e.name };
  if (!validEmail(email)) return { error: e.email };

  if (email !== admin.email) {
    // the email is what signs in, so changing it asks for the password even on an open session
    const user = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, admin.id) });
    if (!user || !(await verifyPassword(String(formData.get("current") ?? ""), user.passwordHash))) return { error: t.settings.wrong };
    const clash = await db.query.adminUsers.findFirst({ where: and(eq(schema.adminUsers.email, email), ne(schema.adminUsers.id, admin.id)), columns: { id: true } });
    if (clash) return { error: t.account.emailTaken };
  }
  await db.update(schema.adminUsers).set({ name, email }).where(eq(schema.adminUsers.id, admin.id));
  await audit({ id: admin.id, email }, "auth.profile_updated");
  revalidatePath("/admin", "layout");
  return { ok: t.account.saved };
}

export async function changePassword(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const admin = await requireSession();
  const { t } = await getAdminT();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < 10 || next.length > 128) return { error: t.settings.tooShort };
  if (next !== String(formData.get("confirm") ?? "")) return { error: t.settings.mismatch };
  if (next === current) return { error: t.settings.same };

  const user = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, admin.id) });
  if (!user || !(await verifyPassword(current, user.passwordHash))) return { error: t.settings.wrong };
  await db.update(schema.adminUsers).set({ passwordHash: await hashPassword(next), mustChangePassword: false, passwordChangedAt: new Date() }).where(eq(schema.adminUsers.id, admin.id));
  await revokeSessions(admin.id, await currentSessionId());
  await audit(admin, "auth.password_changed");
  revalidatePath("/admin", "layout");
  if (user.mustChangePassword) redirect("/admin");
  return { ok: t.account.passwordChangedAndContinue };
}

export async function signOutOthers(): Promise<AccountState> {
  const admin = await requireSession();
  const { t } = await getAdminT();
  await revokeSessions(admin.id, await currentSessionId());
  await audit(admin, "auth.sessions_revoked");
  revalidatePath("/admin/account");
  return { ok: t.account.othersSignedOut };
}
