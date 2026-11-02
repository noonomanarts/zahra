import "server-only";
import { headers } from "next/headers";
import { lt } from "drizzle-orm";
import { db, schema } from "@/db";

export const AUDIT_ACTIONS = [
  "auth.login", "auth.login_failed", "auth.logout", "auth.password_changed", "auth.profile_updated", "auth.sessions_revoked",
  "user.created", "user.updated", "user.role_changed", "user.disabled", "user.enabled", "user.deleted", "user.password_reset", "user.sessions_revoked",
  "customer.updated", "customer.disabled", "customer.enabled", "customer.deleted", "customer.sessions_revoked", "customer.reset_link", "customers.exported",
  "order.status_changed", "orders.exported", "request.updated",
  "product.saved", "product.deleted", "workshop.content_saved", "workshop.access_granted", "workshop.access_revoked",
  "term.saved", "term.deleted", "page.saved", "settings.saved",
  "currency.rates_fetched", "currency.rates_approved", "currency.rates_saved", "finance.entry_added", "finance.entry_deleted",
  "coupon.saved", "coupon.deleted", "review.moderated", "review.deleted", "payments.saved", "email.saved", "email.test",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const RETENTION_DAYS = 365;

export async function requestContext() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip"))?.trim().slice(0, 100) || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) || null };
}

/** Records a security event. A logging failure is reported but never undoes the action it describes. */
export async function audit(
  actor: { id: number; email: string } | { email: string } | null,
  action: AuditAction,
  target?: { type: string; id?: number; label: string; details?: Record<string, string> },
) {
  try {
    const { ip } = await requestContext();
    await db.insert(schema.adminAuditLog).values({
      actorId: actor && "id" in actor ? actor.id : null,
      actorEmail: actor?.email.slice(0, 254) ?? "",
      action,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      targetLabel: target?.label.slice(0, 254) ?? null,
      details: target?.details ?? null,
      ip,
    });
  } catch (error) {
    console.error("audit log write failed", action, error);
  }
}

export async function pruneAuditLog() {
  await db.delete(schema.adminAuditLog).where(lt(schema.adminAuditLog.createdAt, new Date(Date.now() - RETENTION_DAYS * 864e5)));
}
