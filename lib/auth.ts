import "server-only";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, lt, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requestContext } from "@/lib/audit";
import { can, resolvePermissions, type Permission } from "@/lib/permissions";

export const SESSION_COOKIE = "zds_admin";
const SESSION_DAYS = 7;
const SEEN_INTERVAL = 5 * 60_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 864e5);
  const { ip, userAgent } = await requestContext();
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now));
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt, createdAt: now, lastSeenAt: now, ip, userAgent });
  await db.update(schema.adminUsers).set({ lastLoginAt: now, lastSeenAt: now }).where(eq(schema.adminUsers.id, userId));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

/** The session id of this browser, so "sign out other devices" can keep it. */
export async function currentSessionId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

/** Ends every session of a user, optionally except one. */
export async function revokeSessions(userId: number, except?: string | null) {
  await db.delete(schema.sessions).where(except ? and(eq(schema.sessions.userId, userId), ne(schema.sessions.id, except)) : eq(schema.sessions.userId, userId));
}

/** The signed-in administrator with their current access, or null. Cached per request. */
export const getAdmin = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, hashToken(token)) });
  if (!session || session.expiresAt < new Date()) return null;
  const user = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, session.userId) });
  if (!user || !user.active) return null;

  const now = new Date();
  if (!session.lastSeenAt || now.getTime() - session.lastSeenAt.getTime() > SEEN_INTERVAL) {
    await Promise.all([
      db.update(schema.sessions).set({ lastSeenAt: now }).where(eq(schema.sessions.id, session.id)),
      db.update(schema.adminUsers).set({ lastSeenAt: now, updatedAt: user.updatedAt }).where(eq(schema.adminUsers.id, user.id)),
    ]);
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: resolvePermissions(user.role, user.permissions),
    mustChangePassword: user.mustChangePassword,
  };
});

/** Any signed-in administrator, even one who still has to replace a temporary password (their own account page). */
export async function requireSession() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** Use at the top of every admin page and Server Action, with the permission it needs. */
export async function requireAdmin(permission?: Permission) {
  const admin = await requireSession();
  if (admin.mustChangePassword) redirect("/admin/account");
  if (permission && !can(admin.permissions, permission)) redirect("/admin/forbidden");
  return admin;
}

/** For Route Handlers, which answer with a status code instead of a redirect. */
export async function adminCan(permission: Permission) {
  const admin = await getAdmin();
  return Boolean(admin && !admin.mustChangePassword && can(admin.permissions, permission));
}
