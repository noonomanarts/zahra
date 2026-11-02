import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createClient } from "@libsql/client";
import { load } from "cheerio";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { callbackFields, isHexKey, notificationFields, sameAmwalHash, signAmwalFields, signAmwalRequest } from "../lib/amwalpay-sign";
import { couponDiscount, couponProblem, normalizeCode } from "../lib/coupon-rules";
import { hashPassword } from "../lib/password";
import { ROLE_PRESETS, can, resolvePermissions } from "../lib/permissions";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASSWORD = "Fixture-password-2026!";
const AMWAL_KEY = "00112233445566778899aabbccddeeff";
const HMAC_SECRET = "paymob-test-hmac";

test("coupon rules", () => {
  const base = { type: "percent" as const, value: 10, minSubtotal: null, startsOn: null, endsOn: null, active: true };
  assert.equal(normalizeCode(" eid-10 "), "EID-10");
  assert.equal(couponDiscount(base, 12.5), 1.25);
  assert.equal(couponDiscount({ type: "percent", value: 100 }, 12.5), 12.5);
  assert.equal(couponDiscount({ type: "percent", value: 500 }, 10), 10, "never over 100%");
  assert.equal(couponDiscount({ type: "fixed", value: 20 }, 5), 5, "never more than the products cost");
  assert.equal(couponDiscount({ type: "percent", value: 33 }, 3.333), 1.1, "three decimals, as OMR has");
  assert.equal(couponProblem(base, 5, "2026-11-02"), null);
  assert.equal(couponProblem({ ...base, active: false }, 5, "2026-11-02"), "invalid");
  assert.equal(couponProblem({ ...base, startsOn: "2026-11-03" }, 5, "2026-11-02"), "expired");
  assert.equal(couponProblem({ ...base, endsOn: "2026-11-02" }, 5, "2026-11-02"), null, "the last day still works");
  assert.equal(couponProblem({ ...base, endsOn: "2026-11-01" }, 5, "2026-11-02"), "expired");
  assert.equal(couponProblem({ ...base, minSubtotal: 6 }, 5, "2026-11-02"), "minimum");
});

test("AmwalPay signatures match the format of its official plugins", () => {
  // independently computed: HMAC-SHA256, hex-decoded key, upper-case hex
  const text = "Amount=12.500&CurrencyId=512&MerchantId=M1&MerchantReference=R1&RequestDateTime=20261102120000&SessionToken=&TerminalId=T1";
  const expected = createHmac("sha256", Buffer.from(AMWAL_KEY, "hex")).update(text).digest("hex").toUpperCase();
  assert.equal(signAmwalRequest({ amount: "12.500", merchantId: "M1", merchantReference: "R1", terminalId: "T1", dateTime: "20261102120000" }, AMWAL_KEY), expected);
  const nullText = "a=&b=&c=1&d=";
  assert.equal(signAmwalFields([["a", "null"], ["b", "undefined"], ["c", 1], ["d", null]], AMWAL_KEY), createHmac("sha256", Buffer.from(AMWAL_KEY, "hex")).update(nullText).digest("hex").toUpperCase());
  assert.equal(sameAmwalHash("ABC", "abc"), true);
  assert.equal(sameAmwalHash("ABC", "abd"), false);
  assert.equal(sameAmwalHash("ABC", undefined), false);
  assert.equal(isHexKey(AMWAL_KEY), true);
  assert.equal(isHexKey("xyz"), false);
  assert.equal(isHexKey("abc"), false, "odd length can't be decoded");
});

test("payment keys are for owners and administrators only", () => {
  for (const [role, map] of Object.entries(ROLE_PRESETS)) assert.equal(map.payments !== "none", role === "owner" || role === "admin", role);
  assert.equal(can(resolvePermissions("custom", {}), "payments.view"), false);
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

const listen = (server: Server) => new Promise<number>((resolve) => server.listen(0, "127.0.0.1", () => {
  const a = server.address();
  assert(a && typeof a !== "string");
  resolve(a.port);
}));

// Run `npm run build` first. Real production server; Paymob is a local stand-in that records what it receives.
test("orders, coupons, stock and both gateways", { timeout: 180_000 }, async (t) => {
  const scratch = await mkdtemp(path.join(tmpdir(), "zahra-commerce-"));
  const db = createClient({ url: `file:${path.join(scratch, "test.db")}` });
  await migrate(drizzle(db), { migrationsFolder: path.join(projectRoot, "db/migrations") });

  const intentions: { amount: number; items: { amount: number; quantity: number }[]; special_reference: string }[] = [];
  const paymob = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      const data = JSON.parse(body);
      intentions.push(data);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ id: `int-${intentions.length}`, client_secret: "secret", intention_order_id: 5000 + intentions.length }));
    });
  });
  const paymobPort = await listen(paymob);
  const free = createServer();
  const port = await listen(free);
  await new Promise((r) => free.close(r));
  const base = `http://127.0.0.1:${port}`;
  let log = "";
  const child: ChildProcess = spawn(process.execPath, [path.join(projectRoot, "node_modules/next/dist/bin/next"), "start", projectRoot, "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: projectRoot,
    env: {
      PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
      DATABASE_URL: `file:${path.join(scratch, "test.db")}`, APP_URL: base, UPLOAD_DIR: path.join(scratch, "uploads"), PRIVATE_DIR: path.join(scratch, "private"), SETTINGS_SECRET: "test-secret",
      PAYMOB_API_URL: `http://127.0.0.1:${paymobPort}`, PAYMOB_CHECKOUT_URL: "https://stub.test", PAYMOB_SECRET_KEY: "sk", PAYMOB_PUBLIC_KEY: "pk", PAYMOB_HMAC_SECRET: HMAC_SECRET, PAYMOB_INTEGRATION_IDS: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (c) => { log = (log + c).slice(-8000); });
  child.stderr?.on("data", (c) => { log = (log + c).slice(-8000); });
  t.after(async () => {
    if (child.exitCode === null) await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGTERM"); });
    await new Promise((r) => paymob.close(r));
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
    const response = await fetch(`${base}${route}`, { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(20_000) });
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
  const row = async (sql: string, ...args: (string | number)[]) => (await db.execute({ sql, args })).rows[0];

  const hash = await hashPassword(PASSWORD);
  await db.execute({ sql: "INSERT INTO admin_users (email,name,role,password_hash) VALUES ('owner@example.test','Owner','owner',?)", args: [hash] });
  await db.execute({ sql: "INSERT INTO admin_users (email,name,role,password_hash) VALUES ('sales@example.test','Sales','sales',?)", args: [hash] });
  await db.execute("INSERT INTO products (slug,name,price,digital,stock) VALUES ('kit','Kit',10,0,3)");
  await db.execute("INSERT INTO products (slug,name,price,digital) VALUES ('pdf','Pdf',4,1)");
  await db.execute("INSERT INTO coupons (code,type,value) VALUES ('TEN','percent',10)");
  await db.execute("INSERT INTO coupons (code,type,value) VALUES ('ALL','percent',100)");
  await db.execute("INSERT INTO coupons (code,type,value,max_uses) VALUES ('ONCE','fixed',1,1)");

  const signIn = async (email: string) => {
    const jar = new Jar();
    const r = await post(await readForm("/admin/login", jar, 'input[name="password"]'), jar, { email, password: PASSWORD });
    assert.equal(r.status, 303);
    return jar;
  };
  const owner = await signIn("owner@example.test");
  const sales = await signIn("sales@example.test");

  await t.test("payment keys are stored encrypted and never reach the browser", async () => {
    const form = await readForm("/admin/payments", owner, 'input[name="amwal_merchantId"]');
    await post(form, owner, { active: "amwalpay", amwal_environment: "uat", amwal_merchantId: "M77", amwal_terminalId: "T77", amwal_secretKey: "not-hex" });
    assert.equal(await row("SELECT value FROM settings WHERE key='payments'"), undefined, "an invalid key saves nothing");
    await post(form, owner, { active: "amwalpay", amwal_environment: "uat", amwal_merchantId: "", amwal_terminalId: "", amwal_secretKey: "" });
    assert.equal(await row("SELECT value FROM settings WHERE key='payments'"), undefined, "an incomplete gateway can't be switched on");

    await post(form, owner, { active: "amwalpay", amwal_environment: "uat", amwal_merchantId: "M77", amwal_terminalId: "T77", amwal_secretKey: AMWAL_KEY, paymob_hmacSecret: HMAC_SECRET });
    const stored = String((await row("SELECT value FROM settings WHERE key='payments'")).value);
    assert(!stored.includes(AMWAL_KEY) && !stored.includes(HMAC_SECRET), "keys are encrypted at rest");
    const html = await (await request("/admin/payments", owner)).text();
    assert(html.includes("M77"));
    assert(!html.includes(AMWAL_KEY) && !html.includes(HMAC_SECRET), "keys never go back to the browser");
    const log = String((await row("SELECT group_concat(coalesce(target_label,'')||coalesce(details,'')) AS v FROM admin_audit_log")).v);
    assert(!log.includes(AMWAL_KEY));
    const denied = await post(form, sales, { active: "none" });
    assert.equal(denied.status, 303);
    assert.equal(new URL(denied.headers.get("location")!, base).pathname, "/admin/forbidden");
    assert.equal((await request("/admin/payments", sales)).status, 307);

    // saving again with the secret left empty keeps it
    await post(form, owner, { active: "amwalpay", amwal_environment: "uat", amwal_merchantId: "M77", amwal_terminalId: "T77", amwal_secretKey: "" });
    assert.equal(String((await row("SELECT value FROM settings WHERE key='payments'")).value).includes("v1."), true);
  });

  const insertOrder = async (reference: string, gateway: string, total: number, extra = "pending") => {
    await db.execute({ sql: "INSERT INTO orders (number,customer_name,email,phone,currency,subtotal,total,status,payment_reference,payment_gateway,stock_reserved) VALUES (?,?,?,?,?,?,?,?,?,?,1)", args: [`N-${reference}`, "Buyer", "buyer@example.test", "91234567", "OMR", total, total, extra, reference, gateway] });
    const id = Number((await row("SELECT id FROM orders WHERE payment_reference=?", reference)).id);
    await db.execute({ sql: "INSERT INTO order_items (order_id,product_id,slug,name,unit_price,quantity,digital) VALUES (?,1,'kit','Kit',?,1,0)", args: [id, total] });
    return id;
  };
  const statusOf = async (id: number) => String((await row("SELECT status FROM orders WHERE id=?", id)).status);
  const callback = (reference: string, amount: string, responseCode = "00", overrides: Record<string, string> = {}) => {
    const q: Record<string, string> = { amount, currencyId: "512", customerId: "null", customerTokenId: "null", merchantReference: reference, responseCode, transactionId: "TX1", transactionTime: "2026-11-02", ...overrides };
    q.secureHashValue = signAmwalFields(callbackFields(q, "M77", "T77"), AMWAL_KEY);
    return q;
  };

  await t.test("the AmwalPay payment page signs the order's amount", async () => {
    await insertOrder("AP-page", "amwalpay", 12.5);
    const html = await (await request("/en/checkout/pay?ref=AP-page", new Jar())).text();
    assert(html.includes("test.amwalpg.com:7443"), "the test environment's script");
    const match = html.replace(/\\/g, "").match(/"AmountTrxn":"([\d.]+)".*?"SecureHash":"([0-9A-F]{64})","TrxDateTime":"(\d{14})"/);
    assert(match, "payload on the page");
    assert.equal(match[1], "12.500");
    assert.equal(match[2], signAmwalRequest({ amount: "12.500", merchantId: "M77", merchantReference: "AP-page", terminalId: "T77", dateTime: match[3] }, AMWAL_KEY));
    assert(!html.includes(AMWAL_KEY));
    assert.equal((await request("/en/checkout/pay?ref=nope", new Jar())).status, 404);
  });

  await t.test("an AmwalPay return only counts when signed, successful and for the right amount", async () => {
    const id = await insertOrder("AP-ok", "amwalpay", 12.5);
    const forged = callback("AP-ok", "12.500");
    forged.secureHashValue = "0".repeat(64);
    await request(`/en/checkout/result?${new URLSearchParams(forged)}`, new Jar());
    assert.equal(await statusOf(id), "pending", "a forged signature changes nothing");

    const tampered = callback("AP-ok", "12.500");
    tampered.amount = "0.001";
    await request(`/en/checkout/result?${new URLSearchParams(tampered)}`, new Jar());
    assert.equal(await statusOf(id), "pending", "the amount is part of the signature");

    await request(`/en/checkout/result?${new URLSearchParams(callback("AP-ok", "1.000"))}`, new Jar());
    assert.equal(await statusOf(id), "pending", "a signed but wrong amount doesn't pay the order");

    await request(`/en/checkout/result?${new URLSearchParams(callback("AP-ok", "12.5"))}`, new Jar());
    assert.equal(await statusOf(id), "paid");
    assert.equal((await row("SELECT gateway_transaction_id AS v FROM orders WHERE id=?", id)).v, "TX1");

    await request(`/en/checkout/result?${new URLSearchParams(callback("AP-ok", "12.500", "05"))}`, new Jar());
    assert.equal(await statusOf(id), "paid", "a paid order is never downgraded");

    const failed = await insertOrder("AP-no", "amwalpay", 5);
    await request(`/en/checkout/result?${new URLSearchParams(callback("AP-no", "5.000", "05"))}`, new Jar());
    assert.equal(await statusOf(failed), "failed");
  });

  await t.test("AmwalPay's server notification settles an order and refuses a bad signature", async () => {
    const id = await insertOrder("AP-hook", "amwalpay", 7);
    const body: Record<string, unknown> = { Amount: 7, AuthorizationDateTime: "x", CurrencyId: 512, DateTimeLocalTrxn: "y", MerchantId: "M77", MerchantReference: "AP-hook", Message: "ok", PaidThrough: "Card", ResponseCode: "00", SystemReference: "SYS9", TerminalId: "T77", TxnType: 1 };
    const send = (b: unknown) => request("/api/amwalpay/webhook", new Jar(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    assert.equal((await send({ ...body, SecureHash: "bad" })).status, 401);
    assert.equal((await send({ ...body, MerchantId: "OTHER", SecureHash: signAmwalFields(notificationFields(body, "M77", "T77"), AMWAL_KEY) })).status, 401);
    assert.equal(await statusOf(id), "pending");
    assert.equal((await send({ ...body, SecureHash: signAmwalFields(notificationFields(body, "M77", "T77"), AMWAL_KEY) })).status, 200);
    assert.equal(await statusOf(id), "paid");
  });

  await t.test("after switching gateways, a payment started on the other one still settles", async () => {
    const form = await readForm("/admin/payments", owner, 'input[name="amwal_merchantId"]');
    await post(form, owner, { active: "paymob", amwal_environment: "uat", amwal_merchantId: "M77", amwal_terminalId: "T77", amwal_secretKey: "", paymob_publicKey: "pk", paymob_secretKey: "sk", paymob_hmacSecret: HMAC_SECRET, paymob_integrationIds: "1", paymob_apiUrl: `http://127.0.0.1:${paymobPort}`, paymob_checkoutUrl: "https://stub.test" });
    const id = await insertOrder("AP-late", "amwalpay", 3);
    await request(`/en/checkout/result?${new URLSearchParams(callback("AP-late", "3.000"))}`, new Jar());
    assert.equal(await statusOf(id), "paid");
  });

  await t.test("order status changes keep counted stock right", async () => {
    await db.execute("UPDATE products SET stock=5 WHERE id=1");
    const id = await insertOrder("ST-1", "amwalpay", 10, "paid");
    const update = await readForm(`/admin/orders/${id}`, owner, 'select[name="status"], input[name="id"]');
    await post(update, owner, { id: String(id), status: "cancelled" });
    assert.equal((await row("SELECT stock AS v FROM products WHERE id=1")).v, 6, "a cancelled order gives its piece back");
    await post(update, owner, { id: String(id), status: "cancelled" });
    assert.equal((await row("SELECT stock AS v FROM products WHERE id=1")).v, 6, "only once");
    await post(update, owner, { id: String(id), status: "paid" });
    assert.equal((await row("SELECT stock AS v FROM products WHERE id=1")).v, 5, "reviving it takes the piece again");
    await db.execute("UPDATE products SET stock=0 WHERE id=1");
  });

  await t.test("coupons are managed in the admin and limited by permission", async () => {
    const create = await readForm("/admin/coupons", owner, 'input[name="code"]');
    await post(create, owner, { code: "new-code", type: "percent", value: "150", active: "on" });
    assert.equal(await row("SELECT id FROM coupons WHERE code='NEW-CODE'"), undefined, "over 100% is refused");
    await post(create, owner, { code: "new-code", type: "percent", value: "15", active: "on" });
    assert((await row("SELECT id FROM coupons WHERE code='NEW-CODE'")), "saved in upper case");
    const denied = await post(create, sales, { code: "SALES", type: "percent", value: "99", active: "on" });
    assert.equal(new URL(denied.headers.get("location")!, base).pathname, "/admin/forbidden");
    assert.equal((await request("/admin/coupons", sales)).status, 200, "sales can see coupons");
  });

  await t.test("only real buyers can review, and only approved reviews appear", async () => {
    await db.execute({ sql: "INSERT INTO customers (email,name,password_hash) VALUES ('buyer@example.test','Sara Ahmed',?)", args: [hash] });
    await db.execute({ sql: "INSERT INTO customers (email,name,password_hash) VALUES ('other@example.test','Other Person',?)", args: [hash] });
    await db.execute("UPDATE products SET stock=NULL WHERE id=1");
    const buyerId = Number((await row("SELECT id FROM customers WHERE email='buyer@example.test'")).id);
    const shop = new Jar();
    assert.equal((await post(await readForm("/en/login", shop, 'input[name="email"]'), shop, { email: "buyer@example.test", password: PASSWORD })).status, 303);
    const route = "/en/products/kit";
    assert(!(await (await request(route, shop)).text()).includes('name="rating"'), "no form before buying");
    await db.execute({ sql: "UPDATE orders SET customer_id=?, status='paid' WHERE payment_reference='ST-1'", args: [buyerId] });
    const form = await readForm(route, shop, 'input[name="rating"]');
    await post(form, shop, { rating: "5", body: "Beautiful kit <script>alert(1)</script>" });
    assert.equal((await row("SELECT status AS v FROM product_reviews")).v, "pending");
    assert(!(await (await request(route, new Jar())).text()).includes("Beautiful kit"), "hidden until approved");

    const other = new Jar();
    await post(await readForm("/en/login", other, 'input[name="email"]'), other, { email: "other@example.test", password: PASSWORD });
    await post(form, other, { rating: "1", body: "I never bought this" });
    assert.equal((await row("SELECT count(*) AS v FROM product_reviews")).v, 1, "a non-buyer replaying the form is refused");

    const approve = await readForm("/admin/reviews", owner, 'input[name="status"][value="approved"]');
    await post(approve, owner);
    const html = await (await request(route, new Jar())).text();
    assert(html.includes("Beautiful kit"));
    assert(html.includes("Sara") && !html.includes("Sara Ahmed") && !html.includes("buyer@example.test"), "first name only");
    assert(!html.includes("<script>alert(1)"), "escaped");
    assert(html.includes('"aggregateRating"'));
  });
});
