import "server-only";
import { eq, lt } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db, schema } from "@/db";
import type { RenderedEmail } from "./email-templates";
import { notifyAdmins } from "./admin-notifications";
import { decryptSecret } from "./secrets";

export const SMTP_SECURITY = ["starttls", "tls", "none"] as const;
export type SmtpSecurity = (typeof SMTP_SECURITY)[number];

/** Stored under the "email" setting; the password is encrypted. */
export type StoredEmail = {
  enabled: boolean;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  adminEmails: string;
  customerEmails: boolean;
  adminAlerts: boolean;
};

const LOG_DAYS = 180;

export async function loadEmailSettings(): Promise<StoredEmail | null> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, "email") });
  return (row?.value as StoredEmail | undefined) ?? null;
}

export const emailConfigured = (s: StoredEmail | null): s is StoredEmail => Boolean(s?.host && s.fromEmail);
export const emailReady = async () => {
  const s = await loadEmailSettings();
  return emailConfigured(s) && s.enabled;
};

function transportFor(s: StoredEmail) {
  const password = decryptSecret(s.password);
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.security === "tls",
    requireTLS: s.security === "starttls",
    ignoreTLS: s.security === "none",
    auth: s.username ? { user: s.username, pass: password ?? "" } : undefined,
    // a slow mail server must not hold anything up for long
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
}

const fromOf = (s: StoredEmail) => ({ name: s.fromName.replace(/[\r\n"]/g, " ").trim() || s.fromEmail, address: s.fromEmail });

/** Sends with these settings and throws on failure: for the test button, which shows the reason. */
export async function sendWithSettings(s: StoredEmail, to: string, email: RenderedEmail) {
  const transport = transportFor(s);
  try {
    await transport.sendMail({ from: fromOf(s), to, replyTo: s.replyTo || undefined, subject: email.subject, html: email.html, text: email.text });
  } finally {
    transport.close();
  }
}

type Meta = { kind: string; replyTo?: string };

/**
 * Sends one email and records the outcome. Never throws: a mail problem must not fail an order or a payment.
 * The log keeps who and what kind, never the body, which can hold a password link.
 */
export async function sendEmail(to: string, email: RenderedEmail, meta: Meta) {
  const s = await loadEmailSettings();
  if (!emailConfigured(s) || !s.enabled) return false;
  let error: string | null = null;
  try {
    const transport = transportFor(s);
    try {
      await transport.sendMail({ from: fromOf(s), to, replyTo: meta.replyTo || s.replyTo || undefined, subject: email.subject, html: email.html, text: email.text });
    } finally {
      transport.close();
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message.slice(0, 300) : "failed";
    console.error(`email "${meta.kind}" failed`, error);
    await notifyAdmins("email.failed", { recipient: to, subject: email.subject, reason: error }, "/admin/email");
  }
  try {
    await db.insert(schema.emailLog).values({ recipient: to.slice(0, 254), subject: email.subject.slice(0, 200), kind: meta.kind, error });
    await db.delete(schema.emailLog).where(lt(schema.emailLog.createdAt, new Date(Date.now() - LOG_DAYS * 864e5)));
  } catch (cause) {
    console.error("email log write failed", cause);
  }
  return !error;
}

/** Runs mail work after the response has been decided, so customers never wait for the mail server. */
export function inBackground(work: () => Promise<unknown>) {
  void work().catch((cause) => console.error("background email failed", cause));
}
