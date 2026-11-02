import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { ADMIN_ROLES, ROLE_PRESETS, SECTIONS, can, normalizePermissions, permissionList, resolvePermissions, staffDenial, withinLimit } from "../lib/permissions";
import { getAdminDictionary } from "../lib/i18n/admin";

const staff = (id: number, role: string, custom?: unknown) => ({ id, role, permissions: resolvePermissions(role, custom) });
const owner = staff(1, "owner");
const admin = staff(2, "admin");
const sales = staff(3, "sales");

test("view and manage levels", () => {
  const map = resolvePermissions("sales");
  assert.equal(can(map, "orders.manage"), true);
  assert.equal(can(map, "customers.view"), true);
  assert.equal(can(map, "customers.manage"), false);
  assert.equal(can(map, "finance.view"), false);
  assert.deepEqual(permissionList(resolvePermissions("custom", { pages: "view" })), ["pages.view"]);
});

test("unknown roles and malformed custom access grant nothing", () => {
  for (const role of ["root", "", "__proto__", "constructor"]) assert.equal(SECTIONS.some((s) => resolvePermissions(role)[s] !== "none"), false, role);
  assert.equal(SECTIONS.some((s) => resolvePermissions("custom", null)[s] !== "none"), false);
  assert.equal(normalizePermissions({ users: "root", orders: "view" }).users, "none");
  assert.equal(normalizePermissions({ users: "root", orders: "view" }).orders, "view");
});

test("only owner and admin reach the team, and every role is defined", () => {
  for (const role of ADMIN_ROLES.filter((r) => r !== "custom")) {
    const reaches = ROLE_PRESETS[role as keyof typeof ROLE_PRESETS].users !== "none";
    assert.equal(reaches, role === "owner" || role === "admin", role);
  }
});

test("nobody manages their own account from the team page", () => {
  assert.equal(staffDenial(owner, owner, { role: "viewer", permissions: resolvePermissions("viewer") }), "self");
  assert.equal(staffDenial(owner, owner, null), "self");
});

test("owner accounts are for owners only", () => {
  assert.equal(staffDenial(admin, staff(9, "owner"), null), "ownerOnly");
  assert.equal(staffDenial(admin, null, { role: "owner", permissions: resolvePermissions("owner") }), "ownerOnly");
  assert.equal(staffDenial(admin, sales, { role: "owner", permissions: resolvePermissions("owner") }), "ownerOnly");
  assert.equal(staffDenial(owner, staff(9, "owner"), { role: "admin", permissions: resolvePermissions("admin") }), null);
});

test("no one can hand out or touch more than they hold", () => {
  const delegate = staff(5, "custom", { users: "manage", orders: "manage" });
  assert.equal(staffDenial(delegate, null, { role: "custom", permissions: resolvePermissions("custom", { orders: "view" }) }), null);
  assert.equal(staffDenial(delegate, null, { role: "custom", permissions: resolvePermissions("custom", { finance: "view" }) }), "exceeds");
  assert.equal(staffDenial(delegate, null, { role: "admin", permissions: resolvePermissions("admin") }), "exceeds");
  assert.equal(staffDenial(delegate, staff(6, "accountant"), null), "exceeds");
  assert.equal(staffDenial(sales, null, { role: "viewer", permissions: resolvePermissions("viewer") }), "noPermission");
  assert.equal(withinLimit(resolvePermissions("viewer"), resolvePermissions("admin")), true);
});

test("every role, section and level has a label in both languages", () => {
  for (const lang of ["en", "ar"] as const) {
    const p = getAdminDictionary(lang).people;
    for (const r of ADMIN_ROLES) assert.ok(p.roles[r] && p.roleInfo[r], `${lang} ${r}`);
    for (const s of SECTIONS) assert.ok(p.sections[s] && p.sectionInfo[s], `${lang} ${s}`);
  }
});

// A new page, action or download can't silently skip the access check.
const root = path.resolve(import.meta.dirname, "..");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const full = path.join(dir, f);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
const adminFiles = walk(path.join(root, "app/admin")).map((f) => path.relative(root, f));
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("every admin page names the permission it needs", () => {
  const open = new Set(["app/admin/page.tsx", "app/admin/login/page.tsx", "app/admin/forbidden/page.tsx", "app/admin/account/page.tsx", "app/admin/search/page.tsx"]);
  for (const file of adminFiles.filter((f) => f.endsWith("page.tsx") && !open.has(f))) {
    assert.match(read(file), /requireAdmin\("[a-z]+\.(view|manage)"\)/, file);
  }
});

test("every admin Server Action requires manage access", () => {
  const open = new Set(["app/admin/actions.ts", "app/admin/account/actions.ts"]);
  for (const file of adminFiles.filter((f) => f.endsWith("actions.ts") && !open.has(f))) {
    const source = read(file);
    const actions = source.split(/^export async function /m).slice(1);
    assert.ok(actions.length, file);
    for (const body of actions) {
      assert.match(body, /requireAdmin\("[a-z]+\.manage"\)|manageKind\(/, `${file}: ${body.slice(0, 40)}`);
    }
  }
});

test("every admin download checks a permission", () => {
  for (const file of adminFiles.filter((f) => f.endsWith("route.ts"))) {
    assert.match(read(file), /adminCan\("[a-z]+\.(view|manage)"\)/, file);
  }
});
