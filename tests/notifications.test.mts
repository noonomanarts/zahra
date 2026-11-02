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
import { callbackFields, signAmwalFields } from "../lib/amwalpay-sign";
import { getAdminDictionary } from "../lib/i18n/admin";
import { NOTIFICATION_KINDS, kindsFor, stockNotice } from "../lib/notification-kinds";
import { hashPassword } from "../lib/password";
import { permissionList, resolvePermissions } from "../lib/permissions";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASSWORD = "Fixture-password-2026!";
const AMWAL_KEY = "00112233445566778899aabbccddeeff";

test("stock notifies only when it crosses a line", () => {
  assert.equal(stockNotice(5, 4), null);
  assert.equal(stockNotice(4, 3), "stock.low");
  assert.equal(stockNotice(3, 2), null, "already low");
  assert.equal(stockNotice(1, 0), "stock.out");
  assert.equal(stockNotice(5, 0), "stock.out");
});

test("each role hears about its own sections, in both languages", () => {
  const of = (role: string) => kindsFor(permissionList(resolvePermissions(role)));
  assert(of("sales").includes("order.paid"));
  assert(!of("sales").includes("email.failed"));
  assert(!of("content").includes("order.paid"));
  assert(of("content").includes("review.new"));
  assert(of("owner").includes("email.failed"));
  assert.deepEqual(kindsFor(permissionList(resolvePermissions("custom", {}))), []);
  for (const lang of ["en", "ar"] as const) {
    const kinds = getAdminDictionary(lang).notifications.kinds;
    for (const kind of Object.keys(NOTIFICATION_KINDS)) {
      const text = kinds[kind]?.({ number: "N", name: "A", total: "1", rating: "5", product: "P", email: "e", subject: "s", left: "1", recipient: "r", reason: "x", type: "t", phone: "" });
      assert(text?.title, `${lang} ${kind}`);
    }
  }
});

class Jar {
  values = new Map<string, string>();
  read(response: Response) {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const i = pair.indexOf("=");
      if (pair.slice(i + 1)) this.values.set(pair.slice(0, i), pair.slice(i + 1));
      else this.values.delete(pair.slice(0, i));
    }
  }
  header() {
    return [...this.values].map(([n, v]) => `${n}=${v}`).join("; ");
  }
}

// Run `npm run build` first. Real production server with a disposable database.
test("notifications inside the panel", { timeout: 120_000 }, async (t) => {
  const scratch = await mkdtemp(path.join(tmpdir(), "zahra-notifications-"));
  const db = createClient({ url: `file:${path.join(scratch, "test.db")}` });
  await migrate(drizzle(db), { migrationsFolder: path.join(projectRoot, "db/migrations") });
  const probe = createServer();
  await new Promise<void>((r) => probe.listen(0, "127.0.0.1", r));
  const port = (probe.address() as { port: number }).port;
  await new Promise((r) => probe.close(r));
  const base = `http://127.0.0.1:${port}`;
  let log = "";
  const child: ChildProcess = spawn(process.execPath, [path.join(projectRoot, "node_modules/next/dist/bin/next"), "start", projectRoot, "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: projectRoot,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: `file:${path.join(scratch, "test.db")}`, APP_URL: base, UPLOAD_DIR: path.join(scratch, "uploads"), PRIVATE_DIR: path.join(scratch, "private"), SETTINGS_SECRET: "test-secret" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (c) => { log = (log + c).slice(-8000); });
  child.stderr?.on("data", (c) => { log = (log + c).slice(-8000); });
  t.after(async () => {
    if (child.exitCode === null) await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGTERM"); });
    db.close();
    await rm(scratch, { recursive: true, force: true });
  });
  for (const readyBy = Date.now() + 40_000; ;) {
    try {
      if ((await fetch(`${base}/api/customer`, { signal: AbortSignal.timeout(1000) })).ok) break;
    } catch { /* not listening yet */ }
    assert(Date.now() < readyBy, `server did not start:\n${log}`);
    await new Promise((r) => setTimeout(r, 150));
  }

  const request = async (route: string, jar: Jar, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (jar.values.size) headers.set("Cookie", jar.header());
    const response = await fetch(`${base}${route}`, { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(20_000) }).catch((cause: unknown) => {
      throw new Error(`${init.method ?? "GET"} ${route} failed:\n${log}`, { cause });
    });
    jar.read(response);
    return response;
  };
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
  const hash = await hashPassword(PASSWORD);
  for (const [email, role] of [["owner@example.test", "owner"], ["sales@example.test", "sales"], ["content@example.test", "content"]]) {
    await db.execute({ sql: "INSERT INTO admin_users (email,name,role,password_hash) VALUES (?,?,?,?)", args: [email, email.split("@")[0], role, hash] });
  }
  const signIn = async (email: string) => {
    const jar = new Jar();
    await post(await readForm("/admin/login", jar, 'input[name="password"]'), jar, { email, password: PASSWORD });
    return jar;
  };
  const owner = await signIn("owner@example.test");
  const sales = await signIn("sales@example.test");
  const content = await signIn("content@example.test");
  type Feed = { unread: number; items: { id: number; kind: string; read: boolean; params: Record<string, string> }[] };
  const feed = async (jar: Jar) => (await (await request("/api/admin/notifications", jar)).json()) as Feed;
  const waitForKind = async (jar: Jar, kind: string, count = 1) => {
    for (const until = Date.now() + 8000; ;) {
      const found = (await feed(jar)).items.filter((i) => i.kind === kind).length;
      if (found >= count) return found;
      assert(Date.now() < until, `expected ${kind}\n${log}`);
      await new Promise((r) => setTimeout(r, 60));
    }
  };

  await t.test("the feed is private", async () => {
    assert.equal((await request("/api/admin/notifications", new Jar())).status, 401);
    const shopper = new Jar();
    shopper.values.set("zds_admin", "not-a-session");
    assert.equal((await request("/api/admin/notifications", shopper)).status, 401);
  });

  await t.test("a new customer is announced", async () => {
    const visitor = new Jar();
    const form = await readForm("/en/register", visitor, 'input[name="confirmPassword"]');
    await post(form, visitor, { name: "New Person", email: "new@example.test", password: PASSWORD, confirmPassword: PASSWORD });
    await waitForKind(owner, "customer.new");
    assert.equal((await feed(content)).items.some((i) => i.kind === "customer.new"), false, "a content editor has no customer access");
  });

  const payments = await readForm("/admin/payments", owner, 'input[name="amwal_merchantId"]');
  await post(payments, owner, { active: "amwalpay", amwal_environment: "uat", amwal_merchantId: "1", amwal_terminalId: "2", amwal_secretKey: AMWAL_KEY });
  const pay = (reference: string, amount: string, code = "00") => {
    const q: Record<string, string> = { amount, currencyId: "512", customerId: "null", customerTokenId: "null", merchantReference: reference, responseCode: code, transactionId: "T", transactionTime: "now" };
    q.secureHashValue = signAmwalFields(callbackFields(q, "1", "2"), AMWAL_KEY);
    return request(`/en/checkout/result?${new URLSearchParams(q)}`, new Jar());
  };
  const order = (id: number, reference: string, name = "Sara") => db.execute({ sql: "INSERT INTO orders (id,number,customer_name,email,phone,currency,subtotal,total,payment_reference,payment_gateway) VALUES (?,?,?,'b@example.test','91234567','OMR',5,5,?,'amwalpay')", args: [id, `ZDS-${id}`, name, reference] });

  await t.test("payments are announced once, and problems too", async () => {
    await order(1, "R1", "<script>alert(1)</script>");
    await Promise.all([pay("R1", "5.000"), pay("R1", "5.000"), pay("R1", "5.000")]);
    await waitForKind(sales, "order.paid");
    await new Promise((r) => setTimeout(r, 300));
    assert.equal((await feed(sales)).items.filter((i) => i.kind === "order.paid").length, 1, "once, even when reported three times");
    assert.equal((await feed(content)).items.some((i) => i.kind === "order.paid"), false);

    await order(2, "R2");
    await pay("R2", "5.000", "05");
    await waitForKind(sales, "payment.failed");
    await order(3, "R3");
    await pay("R3", "1.000");
    await waitForKind(owner, "payment.mismatch");

    const page = await (await request("/admin/notifications", owner)).text();
    assert(!page.includes("<script>alert(1)"), "what customers type is escaped");
    assert(page.includes("ZDS-1"));
  });

  await t.test("what staff do themselves isn't announced back to them", async () => {
    await db.execute("INSERT INTO orders (id,number,customer_name,email,phone,currency,subtotal,total) VALUES (9,'ZDS-9','Manual','m@example.test','91234567','OMR',5,5)");
    const before = (await feed(owner)).items.length;
    await post(await readForm("/admin/orders/9", owner, 'input[name="id"]'), owner, { id: "9", status: "paid" });
    await new Promise((r) => setTimeout(r, 300));
    assert.equal((await feed(owner)).items.length, before);
  });

  await t.test("mark all as read clears the count for that person only", async () => {
    const ownerBefore = (await feed(owner)).unread;
    assert(ownerBefore > 0);
    const page = await (await request("/admin/notifications", sales)).text();
    const $ = load(page);
    const form = $("form").filter((_, el) => $(el).find('input[name^="$ACTION_"]').length > 0 && $(el).find("button").length > 0 && $(el).find('input[name="q"]').length === 0).filter((_, el) => $(el).text().includes(getAdminDictionary("en").notifications.markAll)).first();
    assert.equal(form.length, 1);
    const body = new FormData();
    form.find('input[type="hidden"][name]').each((_, el) => { body.append($(el).attr("name")!, $(el).attr("value") ?? ""); });
    await request("/admin/notifications", sales, { method: "POST", headers: { Origin: base }, body });
    assert.equal((await feed(sales)).unread, 0);
    assert.equal((await feed(owner)).unread, ownerBefore);

    await order(4, "R4");
    await pay("R4", "5.000");
    await waitForKind(sales, "order.paid", 2);
    assert.equal((await feed(sales)).unread, 1, "new news counts again");
  });

  await t.test("a new team member starts with a clean slate", async () => {
    const create = await readForm("/admin/users/new", owner, 'input[name="name"]');
    const html = await (await post(create, owner, { name: "Fresh Member", email: "fresh@example.test", role: "manager" })).text();
    const temp = load(html)("dd.font-mono").text().trim();
    const jar = new Jar();
    await post(await readForm("/admin/login", jar, 'input[name="password"]'), jar, { email: "fresh@example.test", password: temp });
    assert.equal((await request("/api/admin/notifications", jar)).status, 401, "not before replacing the temporary password");
    await post(await readForm("/admin/account", jar, 'input[name="current"]'), jar, { current: temp, next: "A-brand-new-password-1", confirm: "A-brand-new-password-1" });
    assert.equal((await feed(jar)).unread, 0);
  });
});
