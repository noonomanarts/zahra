/**
 * Administrator access levels. Plain data and pure rules, shared by the server (which enforces them)
 * and the admin UI (which only hides what the server would refuse).
 */
export const SECTIONS = ["orders", "requests", "finance", "customers", "products", "workshops", "taxonomy", "reviews", "coupons", "pages", "currencies", "payments", "email", "settings", "users"] as const;
export type Section = (typeof SECTIONS)[number];

export const LEVELS = ["none", "view", "manage"] as const;
export type Level = (typeof LEVELS)[number];

export type PermissionMap = Record<Section, Level>;
export type Permission = `${Section}.${"view" | "manage"}`;

export const ADMIN_ROLES = ["owner", "admin", "manager", "sales", "content", "accountant", "viewer", "custom"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

const grant = (manage: Section[], view: Section[] = []): PermissionMap => {
  const map = Object.fromEntries(SECTIONS.map((s) => [s, "none"])) as PermissionMap;
  for (const s of view) map[s] = "view";
  for (const s of manage) map[s] = "manage";
  return map;
};

/** What each built-in role can do. "custom" has no preset: the user's own map applies. */
export const ROLE_PRESETS: Record<Exclude<AdminRole, "custom">, PermissionMap> = {
  owner: grant([...SECTIONS]),
  admin: grant([...SECTIONS]),
  manager: grant(["orders", "requests", "customers", "products", "workshops", "taxonomy", "reviews", "coupons", "pages"], ["finance", "currencies"]),
  sales: grant(["orders", "requests", "reviews"], ["customers", "products", "workshops", "coupons"]),
  content: grant(["products", "workshops", "taxonomy", "reviews", "pages"]),
  accountant: grant(["finance", "currencies"], ["orders", "customers", "products", "workshops", "coupons"]),
  viewer: grant([], ["orders", "requests", "finance", "products", "workshops", "taxonomy", "reviews", "coupons", "pages", "currencies"]),
};

export const isAdminRole = (value: unknown): value is AdminRole => ADMIN_ROLES.includes(value as AdminRole);
export const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level);

/** Keeps known sections with valid levels; anything else means no access. */
export function normalizePermissions(value: unknown): PermissionMap {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(SECTIONS.map((s) => [s, isLevel(raw[s]) ? raw[s] : "none"])) as PermissionMap;
}

export function resolvePermissions(role: string, custom?: unknown): PermissionMap {
  if (role === "custom") return normalizePermissions(custom);
  return isAdminRole(role) ? { ...ROLE_PRESETS[role as Exclude<AdminRole, "custom">] } : grant([]);
}

export function can(map: PermissionMap, permission: Permission) {
  const [section, level] = permission.split(".") as [Section, "view" | "manage"];
  return level === "view" ? map[section] !== "none" : map[section] === "manage";
}

/** The permissions held, as a flat list that is safe to pass to client components. */
export const permissionList = (map: PermissionMap): Permission[] =>
  SECTIONS.flatMap((s) => (map[s] === "manage" ? [`${s}.view`, `${s}.manage`] as Permission[] : map[s] === "view" ? [`${s}.view`] as Permission[] : []));

const rank: Record<Level, number> = { none: 0, view: 1, manage: 2 };

/** True when `map` gives nothing beyond `limit`. */
export const withinLimit = (map: PermissionMap, limit: PermissionMap) => SECTIONS.every((s) => rank[map[s]] <= rank[limit[s]]);

export type StaffActor = { id: number; role: string; permissions: PermissionMap };
export type StaffTarget = { id: number; role: string; permissions: PermissionMap };
export type StaffChange = { role: string; permissions: PermissionMap };
export type StaffDenial = "noPermission" | "self" | "ownerOnly" | "exceeds";

/**
 * Why `actor` may not create or change a colleague (`target` is null when creating, `next` is null when
 * the action leaves the access unchanged), or null when allowed. Nobody can reach beyond their own access.
 */
export function staffDenial(actor: StaffActor, target: StaffTarget | null, next: StaffChange | null): StaffDenial | null {
  if (!can(actor.permissions, "users.manage")) return "noPermission";
  if (target && target.id === actor.id) return "self";
  const isOwner = actor.role === "owner";
  if (!isOwner && (target?.role === "owner" || next?.role === "owner")) return "ownerOnly";
  if (!isOwner && target && !withinLimit(target.permissions, actor.permissions)) return "exceeds";
  if (!isOwner && next && !withinLimit(next.permissions, actor.permissions)) return "exceeds";
  return null;
}
