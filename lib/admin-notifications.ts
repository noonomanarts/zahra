import "server-only";
import { and, count, desc, eq, gt, inArray, isNull, lt, max, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { kindsFor, type NotificationKind } from "./notification-kinds";
import { permissionList, type PermissionMap } from "./permissions";

const KEEP_DAYS = 90;
const n = schema.adminNotifications;
const r = schema.adminNotificationReads;

export type NotificationItem = { id: number; kind: string; params: Record<string, string>; href: string | null; createdAt: number; read: boolean };

/** Tells the team about an event. Never throws: a notification must not fail the order or request behind it. */
export async function notifyAdmins(kind: NotificationKind, params: Record<string, string>, href: string | null) {
  try {
    await db.insert(n).values({ kind, params, href });
    await db.delete(n).where(lt(n.createdAt, new Date(Date.now() - KEEP_DAYS * 864e5)));
  } catch (error) {
    console.error("notification failed", kind, error);
  }
}

type Reader = { id: number; permissions: PermissionMap };

const allowed = (admin: Reader) => kindsFor(permissionList(admin.permissions));

async function watermark(userId: number) {
  const [row] = await db.select({ id: schema.adminUsers.lastReadNotificationId }).from(schema.adminUsers).where(eq(schema.adminUsers.id, userId));
  return row?.id ?? 0;
}

const unreadWhere = (userId: number, upTo: number, kinds: string[]) => and(inArray(n.kind, kinds), gt(n.id, upTo), isNull(r.userId));
const joinReads = (userId: number) => and(eq(r.notificationId, n.id), eq(r.userId, userId));

export async function unreadCount(admin: Reader) {
  const kinds = allowed(admin);
  if (!kinds.length) return 0;
  const [row] = await db.select({ total: count() }).from(n).leftJoin(r, joinReads(admin.id)).where(unreadWhere(admin.id, await watermark(admin.id), kinds));
  return row.total;
}

export async function listNotifications(admin: Reader, options: { limit: number; offset?: number; unreadOnly?: boolean; kinds?: readonly string[] }) {
  const permitted = allowed(admin);
  const kinds = options.kinds ? permitted.filter((k) => options.kinds!.includes(k)) : permitted;
  if (!kinds.length) return { items: [] as NotificationItem[], total: 0 };
  const upTo = await watermark(admin.id);
  const where = options.unreadOnly ? unreadWhere(admin.id, upTo, kinds) : inArray(n.kind, kinds);
  const [rows, [{ total }]] = await Promise.all([
    db.select({ id: n.id, kind: n.kind, params: n.params, href: n.href, createdAt: n.createdAt, readAt: r.userId }).from(n).leftJoin(r, joinReads(admin.id)).where(where).orderBy(desc(n.id)).limit(options.limit).offset(options.offset ?? 0),
    db.select({ total: count() }).from(n).leftJoin(r, joinReads(admin.id)).where(where),
  ]);
  return {
    total,
    items: rows.map((row): NotificationItem => ({ id: row.id, kind: row.kind, params: row.params, href: row.href, createdAt: row.createdAt.getTime(), read: row.id <= upTo || row.readAt !== null })),
  };
}

export async function markNotificationRead(userId: number, id: number) {
  await db.insert(r).values({ notificationId: id, userId }).onConflictDoNothing();
}

export async function markAllNotificationsRead(userId: number) {
  const [{ latest }] = await db.select({ latest: max(n.id) }).from(n);
  await db.update(schema.adminUsers).set({ lastReadNotificationId: sql`max(${schema.adminUsers.lastReadNotificationId}, ${latest ?? 0})` }).where(eq(schema.adminUsers.id, userId));
  await db.delete(r).where(eq(r.userId, userId));
}

/** A new team member starts with a clean slate instead of everything from the last 90 days. */
export async function latestNotificationId() {
  const [{ latest }] = await db.select({ latest: max(n.id) }).from(n);
  return latest ?? 0;
}
