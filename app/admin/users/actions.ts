"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { latestNotificationId } from "@/lib/admin-notifications";
import { audit } from "@/lib/audit";
import { requireAdmin, revokeSessions } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { hashPassword, temporaryPassword } from "@/lib/password";
import { SECTIONS, isAdminRole, isLevel, normalizePermissions, resolvePermissions, staffDenial, type AdminRole, type PermissionMap } from "@/lib/permissions";
import { cleanName, validEmail, validName } from "@/components/admin/people";

export type UserFormState = { error?: string; ok?: string; credentials?: { id: number; email: string; password: string } };

function readAccess(formData: FormData): { role: AdminRole; custom: PermissionMap | null; permissions: PermissionMap } | null {
  const role = formData.get("role");
  if (!isAdminRole(role)) return null;
  const custom = role === "custom"
    ? normalizePermissions(Object.fromEntries(SECTIONS.map((s) => {
      const level = formData.get(`perm_${s}`);
      return [s, isLevel(level) ? level : "none"];
    })))
    : null;
  return { role, custom, permissions: resolvePermissions(role, custom) };
}

const loadTarget = async (id: number) => {
  const user = Number.isInteger(id) ? await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, id) }) : undefined;
  return user ? { ...user, permissions: resolvePermissions(user.role, user.permissions) } : null;
};

/** Would this leave the panel without anyone who has full control? */
const isLastOwner = async (reader: Pick<typeof db, "select">, target: { id: number; role: string; active: boolean }) => {
  if (target.role !== "owner" || !target.active) return false;
  const [others] = await reader.select({ n: count() }).from(schema.adminUsers)
    .where(and(eq(schema.adminUsers.role, "owner"), eq(schema.adminUsers.active, true), ne(schema.adminUsers.id, target.id)));
  return others.n === 0;
};

const refresh = (id?: number) => {
  revalidatePath("/admin/users", "layout");
  if (id) revalidatePath(`/admin/users/${id}`);
};

/** Creates a team member (no id) or saves their profile and access. */
export async function saveUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await requireAdmin("users.manage");
  const { t } = await getAdminT();
  const e = t.people.errors;
  const id = Number(formData.get("id")) || null;
  const name = cleanName(formData.get("name"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const access = readAccess(formData);

  if (!validName(name)) return { error: e.name };
  if (!validEmail(email)) return { error: e.email };
  if (!access) return { error: e.role };
  if (access.role === "custom" && SECTIONS.every((s) => access.permissions[s] === "none")) return { error: e.noAccess };

  const target = id ? await loadTarget(id) : null;
  if (id && !target) return { error: e.missing };
  const denied = staffDenial(actor, target, { role: access.role, permissions: access.permissions });
  if (denied) return { error: e[denied] };

  const clash = await db.query.adminUsers.findFirst({ where: id ? and(eq(schema.adminUsers.email, email), ne(schema.adminUsers.id, id)) : eq(schema.adminUsers.email, email), columns: { id: true } });
  if (clash) return { error: e.emailTaken };

  if (!target) {
    const password = temporaryPassword();
    const [created] = await db.insert(schema.adminUsers)
      .values({ name, email, role: access.role, permissions: access.custom, passwordHash: await hashPassword(password), mustChangePassword: true, lastReadNotificationId: await latestNotificationId() })
      .onConflictDoNothing({ target: schema.adminUsers.email })
      .returning({ id: schema.adminUsers.id });
    if (!created) return { error: e.emailTaken };
    await audit(actor, "user.created", { type: "user", id: created.id, label: email, details: { to: access.role } });
    refresh();
    return { credentials: { id: created.id, email, password } };
  }

  // the check and the write share a transaction, so two owners can't demote each other at the same moment
  const result = await db.transaction(async (tx) => {
    if (access.role !== "owner" && (await isLastOwner(tx, target))) return "lastOwner" as const;
    await tx.update(schema.adminUsers).set({ name, email, role: access.role, permissions: access.custom }).where(eq(schema.adminUsers.id, target.id));
    return null;
  });
  if (result) return { error: e[result] };

  const accessChanged = target.role !== access.role || SECTIONS.some((s) => target.permissions[s] !== access.permissions[s]);
  if (accessChanged) await audit(actor, "user.role_changed", { type: "user", id: target.id, label: email, details: { from: target.role, to: access.role } });
  if (target.name !== name || target.email !== email) await audit(actor, "user.updated", { type: "user", id: target.id, label: email });
  refresh(target.id);
  return { ok: t.people.saved };
}

/** The account actions: disable, enable, sign out everywhere, reset password, delete. */
export async function manageUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await requireAdmin("users.manage");
  const { t } = await getAdminT();
  const p = t.people;
  const target = await loadTarget(Number(formData.get("id")));
  if (!target) return { error: p.errors.missing };
  const denied = staffDenial(actor, target, null);
  if (denied) return { error: p.errors[denied] };
  const about = { type: "user" as const, id: target.id, label: target.email };

  switch (formData.get("op")) {
    case "disable": {
      const refused = await db.transaction(async (tx) => {
        if (await isLastOwner(tx, target)) return true;
        await tx.update(schema.adminUsers).set({ active: false }).where(eq(schema.adminUsers.id, target.id));
        return false;
      });
      if (refused) return { error: p.errors.lastOwner };
      await revokeSessions(target.id);
      await audit(actor, "user.disabled", about);
      refresh(target.id);
      return { ok: p.disabled };
    }
    case "enable": {
      await db.update(schema.adminUsers).set({ active: true }).where(eq(schema.adminUsers.id, target.id));
      await audit(actor, "user.enabled", about);
      refresh(target.id);
      return { ok: p.enabled };
    }
    case "revoke": {
      await revokeSessions(target.id);
      await audit(actor, "user.sessions_revoked", about);
      refresh(target.id);
      return { ok: p.revoked };
    }
    case "reset": {
      const password = temporaryPassword();
      await db.update(schema.adminUsers).set({ passwordHash: await hashPassword(password), mustChangePassword: true, passwordChangedAt: new Date() }).where(eq(schema.adminUsers.id, target.id));
      await revokeSessions(target.id);
      await audit(actor, "user.password_reset", about);
      refresh(target.id);
      return { credentials: { id: target.id, email: target.email, password } };
    }
    case "delete": {
      const refused = await db.transaction(async (tx) => {
        if (await isLastOwner(tx, target)) return true;
        await tx.delete(schema.adminUsers).where(eq(schema.adminUsers.id, target.id));
        return false;
      });
      if (refused) return { error: p.errors.lastOwner };
      await audit(actor, "user.deleted", about);
      refresh();
      redirect("/admin/users");
    }
  }
  return {};
}
