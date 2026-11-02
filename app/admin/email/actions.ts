"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { getSite } from "@/lib/data";
import { SMTP_SECURITY, loadEmailSettings, sendWithSettings, type SmtpSecurity, type StoredEmail } from "@/lib/email";
import { testEmail } from "@/lib/email-templates";
import { getAdminT } from "@/lib/i18n/admin-server";
import { encryptSecret } from "@/lib/secrets";

export type EmailState = { error?: string; ok?: string };

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const text = (formData: FormData, key: string, max = 254) => String(formData.get(key) ?? "").trim().slice(0, max);

/** A password left empty keeps the saved one; it is stored encrypted and never sent back. */
export async function saveEmailSettings(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const admin = await requireAdmin("email.manage");
  const { t } = await getAdminT();
  const e = t.email.errors;
  const current = await loadEmailSettings();
  const host = text(formData, "host");
  const port = Number(formData.get("port"));
  const security = String(formData.get("security")) as SmtpSecurity;
  const fromEmail = text(formData, "fromEmail");
  const replyTo = text(formData, "replyTo");
  const adminEmails = text(formData, "adminEmails", 500);
  const password = String(formData.get("password") ?? "");
  const enabled = formData.get("enabled") === "on";

  if (!SMTP_SECURITY.includes(security) || !Number.isInteger(port) || port < 1 || port > 65535) return { error: e.port };
  if (host && !/^[A-Za-z0-9.-]+$/.test(host)) return { error: e.host };
  if (fromEmail && !EMAIL.test(fromEmail)) return { error: e.from };
  if (replyTo && !EMAIL.test(replyTo)) return { error: e.replyTo };
  if (adminEmails && adminEmails.split(",").some((a) => !EMAIL.test(a.trim()))) return { error: e.admins };
  if (enabled && !(host && fromEmail)) return { error: e.incomplete };

  const next: StoredEmail = {
    enabled,
    host,
    port,
    security,
    username: text(formData, "username"),
    password: password ? encryptSecret(password) : current?.password ?? "",
    fromName: text(formData, "fromName", 100),
    fromEmail,
    replyTo,
    adminEmails,
    customerEmails: formData.get("customerEmails") === "on",
    adminAlerts: formData.get("adminAlerts") === "on",
  };
  await db.insert(schema.settings).values({ key: "email", value: next }).onConflictDoUpdate({ target: schema.settings.key, set: { value: next } });
  await audit(admin, "email.saved", { type: "email", label: enabled ? host : "off" });
  revalidatePath("/admin/email");
  return { ok: t.email.saved };
}

/** Uses the saved settings, even while sending is off, and shows the mail server's answer. */
export async function sendTestEmail(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const admin = await requireAdmin("email.manage");
  const { t } = await getAdminT();
  const to = text(formData, "to");
  if (!EMAIL.test(to)) return { error: t.email.errors.testTo };
  const settings = await loadEmailSettings();
  if (!settings?.host || !settings.fromEmail) return { error: t.email.errors.saveFirst };
  try {
    await sendWithSettings(settings, to, testEmail((await getSite()).name));
  } catch (cause) {
    await audit(admin, "email.test", { type: "email", label: "failed" });
    return { error: t.email.testFailed(cause instanceof Error ? cause.message.slice(0, 300) : "") };
  }
  await audit(admin, "email.test", { type: "email", label: to });
  return { ok: t.email.testSent(to) };
}
