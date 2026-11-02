import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createClient } from "@libsql/client";
import { load } from "cheerio";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { getAdminDictionary } from "../lib/i18n/admin";
import { getDictionary } from "../lib/i18n/dictionaries";
import { hashPassword, verifyPassword } from "../lib/password";

// Run `npm run build` first. Real production server, native form posts and a disposable database.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const t_ = getAdminDictionary("en");
const PASSWORD = "Fixture-password-2026!";

class Jar {
  values = new Map<string, string>();
  read(response: Response) {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      if (!value) this.values.delete(name);
      else this.values.set(name, value);
    }
  }
  header() {
    return [...this.values].map(([n, v]) => `${n}=${v}`).join("; ");
  }
}

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

const redirectsTo = (response: Response, pathname: string) => {
  assert([303, 307, 308].includes(response.status), `expected redirect to ${pathname}, got ${response.status}`);
  assert.equal(new URL(response.headers.get("location")!, "http://x").pathname, pathname);
};

test("administrator access is enforced by the server", { timeout: 120_000 }, async (t) => {
  const scratch = await mkdtemp(path.join(tmpdir(), "zahra-admin-access-"));
  const file = path.join(scratch, "test.db");
  const db = createClient({ url: `file:${file}` });
  const server = { child: undefined as ChildProcess | undefined };
  t.after(async () => {
    const running = server.child;
    if (running && running.exitCode === null) {
      await new Promise<void>((resolve) => {
        running.once("exit", () => resolve());
        running.kill("SIGTERM");
      });
    }
    db.close();
    await rm(scratch, { recursive: true, force: true });
  });

  await migrate(drizzle(db), { migrationsFolder: path.join(projectRoot, "db/migrations") });
  const hash = await hashPassword(PASSWORD);
  const person = async (email: string, role: string) => Number((await db.execute({ sql: "INSERT INTO admin_users (email,name,role,password_hash) VALUES (?,?,?,?) RETURNING id", args: [email, email.split("@")[0], role, hash] })).rows[0].id);
  const ownerId = await person("owner@example.test", "owner");
  const secondOwnerId = await person("owner2@example.test", "owner");
  await person("admin@example.test", "admin");
  await person("sales@example.test", "sales");
  const customerId = Number((await db.execute({ sql: "INSERT INTO customers (email,name,password_hash) VALUES (?,?,?) RETURNING id", args: ["buyer@example.test", "=HYPERLINK(1)", hash] })).rows[0].id);

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let log = "";
  const child = spawn(process.execPath, [path.join(projectRoot, "node_modules/next/dist/bin/next"), "start", projectRoot, "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: projectRoot,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: `file:${file}`, APP_URL: base, UPLOAD_DIR: path.join(scratch, "uploads"), PRIVATE_DIR: path.join(scratch, "private") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.child = child;
  child.stdout?.on("data", (c) => { log = (log + c).slice(-8000); });
  child.stderr?.on("data", (c) => { log = (log + c).slice(-8000); });
  const readyBy = Date.now() + 40_000;
  while (true) {
    try {
      if ((await fetch(`${base}/api/customer`, { signal: AbortSignal.timeout(1000) })).ok) break;
    } catch { /* not listening yet */ }
    assert(Date.now() < readyBy, `server did not start:\n${log}`);
    await new Promise((r) => setTimeout(r, 150));
  }

  const request = async (route: string, jar: Jar, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (jar.values.size) headers.set("Cookie", jar.header());
    const response = await fetch(`${base}${route}`, { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(15_000) });
    jar.read(response);
    return response;
  };
  /** The hidden fields and target of a native Server Action form on a page. */
  const readForm = async (route: string, jar: Jar, selector: string) => {
    const page = await request(route, jar);
    assert.equal(page.status, 200, `could not open ${route}`);
    const $ = load(await page.text());
    const form = $("form").filter((_, el) => $(el).find('input[name^="$ACTION_"]').length > 0 && $(el).find(selector).length > 0).first();
    assert.equal(form.length, 1, `no form with ${selector} on ${route}`);
    const body = new FormData();
    form.find('input[type="hidden"][name]').each((_, el) => { body.append($(el).attr("name")!, $(el).attr("value") ?? ""); });
    return { route, body };
  };
  const post = (form: { route: string; body: FormData }, jar: Jar, fields: Record<string, string> = {}) => {
    const body = new FormData();
    for (const [k, v] of form.body) body.append(k, v);
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    return request(form.route, jar, { method: "POST", headers: { Origin: base }, body });
  };
  const alertOf = async (response: Response) => {
    assert.equal(response.status, 200);
    return load(await response.text())("[role=alert]").text().trim();
  };
  const signIn = async (email: string, password = PASSWORD) => {
    const jar = new Jar();
    const response = await post(await readForm("/admin/login", jar, 'input[name="password"]'), jar, { email, password });
    redirectsTo(response, "/admin");
    return jar;
  };
  const scalar = async (sql: string, ...args: (string | number)[]) => (await db.execute({ sql, args })).rows[0]?.v;

  const owner = await signIn("owner@example.test");
  const admin = await signIn("admin@example.test");
  const sales = await signIn("sales@example.test");

  await t.test("sections outside a role are refused and hidden", async () => {
    for (const route of ["/admin/finance", "/admin/users", "/admin/users/roles", "/admin/users/new", "/admin/settings", "/admin/currencies", "/admin/pages", "/admin/products/new"]) {
      redirectsTo(await request(route, sales), "/admin/forbidden");
    }
    assert.equal((await request("/admin/finance/export", sales)).status, 403);
    assert.equal((await request("/admin/customers/export", sales)).status, 403);
    assert.equal((await request("/admin/orders", sales)).status, 200);
    const dashboard = await (await request("/admin", sales)).text();
    assert(dashboard.includes('href="/admin/orders"'));
    assert(!dashboard.includes('href="/admin/finance"'));
    assert(!dashboard.includes('href="/admin/users"'));
    assert.equal((await request("/admin/finance/export", owner)).status, 200);
  });

  await t.test("a Server Action can't be called without its permission", async () => {
    const create = await readForm("/admin/users/new", owner, 'input[name="name"]');
    const response = await post(create, sales, { name: "Intruder", email: "intruder@example.test", role: "owner" });
    redirectsTo(response, "/admin/forbidden");
    assert.equal(await scalar("SELECT count(*) AS v FROM admin_users WHERE email='intruder@example.test'"), 0);
  });

  await t.test("administrators can't reach above themselves", async () => {
    const create = await readForm("/admin/users/new", admin, 'input[name="name"]');
    assert.equal(await alertOf(await post(create, admin, { name: "Second", email: "second@example.test", role: "owner" })), t_.people.errors.ownerOnly);
    assert.equal(await scalar("SELECT count(*) AS v FROM admin_users WHERE email='second@example.test'"), 0);
    // an administrator's page has no such form, so this replays the owner's; only the database can tell
    const disable = await readForm(`/admin/users/${secondOwnerId}`, owner, 'input[name="op"][value="disable"]');
    await post(disable, admin);
    assert.equal(await scalar("SELECT active AS v FROM admin_users WHERE id=?", secondOwnerId), 1);
    assert.equal(await alertOf(await post(disable, owner, { id: String(ownerId) })), t_.people.errors.self);
  });

  await t.test("disabling ends the session at once, and enabling restores the account", async () => {
    const other = await signIn("owner2@example.test");
    const disable = await readForm(`/admin/users/${ownerId}`, other, 'input[name="op"][value="disable"]');
    await post(disable, other);
    assert.equal(await scalar("SELECT active AS v FROM admin_users WHERE id=?", ownerId), 0);
    redirectsTo(await request("/admin", owner), "/admin/login");
    const enable = await readForm(`/admin/users/${ownerId}`, other, 'input[name="op"][value="enable"]');
    await post(enable, other);
    assert.equal(await scalar("SELECT active AS v FROM admin_users WHERE id=?", ownerId), 1);
  });

  const ownerAgain = await signIn("owner@example.test");

  await t.test("a new member starts on a temporary password that opens nothing else", async () => {
    const create = await readForm("/admin/users/new", ownerAgain, 'input[name="name"]');
    const html = await (await post(create, ownerAgain, { name: "New Editor", email: "NEW@example.test ", role: "content" })).text();
    const temp = load(html)("dd.font-mono").text().trim();
    assert.match(temp, /^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
    assert.equal(await scalar("SELECT must_change_password AS v FROM admin_users WHERE email='new@example.test'"), 1);
    const stored = String(await scalar("SELECT password_hash AS v FROM admin_users WHERE email='new@example.test'"));
    assert(!stored.includes(temp) && (await verifyPassword(temp, stored)));

    const member = await signIn("new@example.test", temp);
    redirectsTo(await request("/admin", member), "/admin/account");
    redirectsTo(await request("/admin/products", member), "/admin/account");
    assert.equal((await request("/admin/finance/export", member)).status, 403);

    const change = await readForm("/admin/account", member, 'input[name="current"]');
    redirectsTo(await post(change, member, { current: temp, next: "A-brand-new-password-1", confirm: "A-brand-new-password-1" }), "/admin");
    assert.equal((await request("/admin/products", member)).status, 200);
    redirectsTo(await request("/admin/orders", member), "/admin/forbidden");
  });

  await t.test("role changes apply at once and a reset ends every session", async () => {
    const id = Number(await scalar("SELECT id AS v FROM admin_users WHERE email='sales@example.test'"));
    const edit = await readForm(`/admin/users/${id}`, ownerAgain, 'input[name="name"]');
    await post(edit, ownerAgain, { name: "sales", email: "sales@example.test", role: "custom", perm_finance: "view", perm_orders: "none" });
    assert.equal((await request("/admin/finance", sales)).status, 200);
    redirectsTo(await request("/admin/orders", sales), "/admin/forbidden");

    const reset = await readForm(`/admin/users/${id}`, ownerAgain, 'input[name="op"][value="reset"]');
    await post(reset, ownerAgain);
    redirectsTo(await request("/admin", sales), "/admin/login");
    assert.equal(await scalar("SELECT count(*) AS v FROM sessions WHERE user_id=?", id), 0);
  });

  await t.test("a suspended customer is signed out and can't return", async () => {
    const shopper = new Jar();
    const login = await readForm("/en/login", shopper, 'input[name="email"]');
    redirectsTo(await post(login, shopper, { email: "buyer@example.test", password: PASSWORD }), "/en/account");
    assert.notEqual((await (await request("/api/customer", shopper)).json()).customer, null);

    const suspend = await readForm(`/admin/customers/${customerId}`, ownerAgain, 'input[name="op"][value="suspend"]');
    await post(suspend, ownerAgain);
    assert.equal((await (await request("/api/customer", shopper)).json()).customer, null);
    const retry = new Jar();
    const again = await readForm("/en/login", retry, 'input[name="email"]');
    assert.equal(await alertOf(await post(again, retry, { email: "buyer@example.test", password: PASSWORD })), getDictionary("en").auth.errors.suspended);
  });

  await t.test("a password link works once, ends sessions and is never stored in clear", async () => {
    const buyer = await db.execute({ sql: "INSERT INTO customers (email,name,password_hash) VALUES (?,?,?) RETURNING id", args: ["reset@example.test", "Reset Me", hash] });
    const id = Number(buyer.rows[0].id);
    const shopper = new Jar();
    redirectsTo(await post(await readForm("/en/login", shopper, 'input[name="email"]'), shopper, { email: "reset@example.test", password: PASSWORD }), "/en/account");

    const create = await readForm(`/admin/customers/${id}`, ownerAgain, 'input[name="op"][value="resetLink"]');
    redirectsTo(await post(create, sales), "/admin/login");
    const link = load(await (await post(create, ownerAgain)).text())("[data-reset-link]").text().trim();
    const token = new URL(link).searchParams.get("token")!;
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(await scalar("SELECT count(*) AS v FROM customer_password_resets WHERE id=?", token), 0);
    assert.equal(await scalar("SELECT count(*) AS v FROM admin_audit_log WHERE coalesce(details,'')||coalesce(target_label,'') LIKE ?", `%${token}%`), 0);

    const route = `/en/reset-password?token=${token}`;
    const visitor = new Jar();
    const form = await readForm(route, visitor, 'input[name="token"]');
    assert.match(await alertOf(await post(form, visitor, { next: "Another-password-1", confirm: "different" })), /match/);
    redirectsTo(await post(form, visitor, { next: "Another-password-1", confirm: "Another-password-1" }), "/en/login");
    assert.equal((await (await request("/api/customer", shopper)).json()).customer, null);
    assert(await verifyPassword("Another-password-1", String(await scalar("SELECT password_hash AS v FROM customers WHERE id=?", id))));
    // used once
    assert.equal(load(await (await request(route, visitor)).text())('input[name="token"]').length, 0);
    await post(form, visitor, { next: "Third-password-11", confirm: "Third-password-11" });
    assert(await verifyPassword("Another-password-1", String(await scalar("SELECT password_hash AS v FROM customers WHERE id=?", id))));

    await db.execute({ sql: "UPDATE customers SET disabled_at=unixepoch() WHERE id=?", args: [id] });
  });

  await t.test("customers manage their own details and password", async () => {
    const buyer = new Jar();
    await db.execute({ sql: "INSERT INTO customers (email,name,password_hash) VALUES (?,?,?)", args: ["self@example.test", "Self Service", hash] });
    redirectsTo(await post(await readForm("/en/login", buyer, 'input[name="email"]'), buyer, { email: "self@example.test", password: PASSWORD }), "/en/account");
    const details = await readForm("/en/account/profile", buyer, 'input[name="name"]');
    const dict = getDictionary("en");
    assert.equal(await alertOf(await post(details, buyer, { name: "Self Service", email: "moved@example.test", current: "wrong-password" })), dict.auth.errors.wrongPassword);
    assert.equal(await alertOf(await post(details, buyer, { name: "Self Service", email: "reset@example.test", current: PASSWORD })), dict.auth.errors.emailInUse);
    await post(details, buyer, { name: "New Name", email: "moved@example.test", current: PASSWORD });
    assert.equal(await scalar("SELECT name AS v FROM customers WHERE email='moved@example.test'"), "New Name");

    const other = new Jar();
    redirectsTo(await post(await readForm("/en/login", other, 'input[name="email"]'), other, { email: "moved@example.test", password: PASSWORD }), "/en/account");
    const password = await readForm("/en/account/profile", buyer, 'input[name="next"]');
    assert.equal(await alertOf(await post(password, buyer, { current: "wrong-password", next: "Changed-password-1", confirm: "Changed-password-1" })), dict.auth.errors.wrongPassword);
    await post(password, buyer, { current: PASSWORD, next: "Changed-password-1", confirm: "Changed-password-1" });
    assert.notEqual((await (await request("/api/customer", buyer)).json()).customer, null);
    assert.equal((await (await request("/api/customer", other)).json()).customer, null);
  });

  await t.test("search and exports follow the same access", async () => {
    await db.execute("INSERT INTO orders (number,customer_name,email,phone,currency,subtotal,total) VALUES ('ZDS-7777','=Search Target','target@example.test','91234567','OMR',5,5)");
    const shopOwner = ownerAgain;
    const found = await (await request("/admin/orders?q=target%40example", shopOwner)).text();
    assert(found.includes("ZDS-7777"));
    assert(!(await (await request("/admin/orders?q=nomatch100%25", shopOwner)).text()).includes("ZDS-7777"));
    assert((await (await request("/admin/search?q=ZDS-7777", shopOwner)).text()).includes('href="/admin/orders/'));
    const csv = await (await request("/admin/orders/export?q=target", shopOwner)).text();
    assert(csv.includes("ZDS-7777") && csv.includes(`"'=Search Target"`));

    const content = await signIn("new@example.test", "A-brand-new-password-1");
    const results = await (await request("/admin/search?q=ZDS-7777", content)).text();
    // the search term is echoed back; a result would be a link to the order
    assert(!results.includes('href="/admin/orders/'), "a content editor has no access to orders");
    assert.equal((await request("/admin/orders/export", content)).status, 403);
  });

  await t.test("public pages tell search engines what to index", async () => {
    const robots = await (await request("/robots.txt", new Jar())).text();
    assert.match(robots, /Disallow: \/admin/);
    assert.match(robots, /Sitemap: /);
    await db.execute("INSERT INTO products (slug,name,price,description,images) VALUES ('seo-item','SEO </script> Item',7.5,'<p>Hand made</p>','[]')");
    const page = await request("/en/products/seo-item", new Jar());
    assert.equal(page.status, 200);
    const $ = load(await page.text());
    const ld = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() ?? "").find((text) => text.includes('"Product"'));
    assert(ld);
    assert(!ld.includes("</script>"));
    const [product] = JSON.parse(ld);
    assert.equal(product.offers.price, 7.5);
    assert.equal($('meta[name="description"]').attr("content"), "Hand made");
  });

  await t.test("the customer export neutralises spreadsheet formulas", async () => {
    const csv = await (await request("/admin/customers/export", ownerAgain)).text();
    assert(csv.includes(`"'=HYPERLINK(1)"`));
    assert(!csv.includes(`"=HYPERLINK`));
  });

  await t.test("the activity log records what happened", async () => {
    const actions = (await db.execute("SELECT DISTINCT action FROM admin_audit_log")).rows.map((r) => r.action);
    for (const a of ["auth.login", "user.created", "user.role_changed", "user.disabled", "user.enabled", "user.password_reset", "customer.disabled", "customer.reset_link", "customers.exported", "orders.exported", "auth.password_changed"]) {
      assert(actions.includes(a), a);
    }
    const page = await (await request("/admin/users/activity", ownerAgain)).text();
    assert(page.includes(t_.people.events["user.created"]));
    const failed = new Jar();
    const form = await readForm("/admin/login", failed, 'input[name="password"]');
    assert((await alertOf(await post(form, failed, { email: "owner@example.test", password: "wrong-password" }))).includes(t_.login.invalid));
    assert.equal(await scalar("SELECT count(*) AS v FROM admin_audit_log WHERE action='auth.login_failed' AND actor_email='owner@example.test'"), 1);
  });
});
