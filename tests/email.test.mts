import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createNet, type Socket } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createClient } from "@libsql/client";
import { load } from "cheerio";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { orderEmail, renderEmail } from "../lib/email-templates";
import { callbackFields, signAmwalFields } from "../lib/amwalpay-sign";
import { hashPassword } from "../lib/password";
import { ROLE_PRESETS } from "../lib/permissions";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASSWORD = "Fixture-password-2026!";
const SMTP_PASSWORD = "smtp-very-secret-99";
const AMWAL_KEY = "00112233445566778899aabbccddeeff";

test("email text is escaped and follows the customer's language", () => {
  const order = { number: "ZDS-1", customerName: "<b>Sara</b>", subtotal: 10, discount: 1, shipping: 2, total: 11, items: [{ name: "Kit & <i>more</i>", quantity: 2, unitPrice: 5, digital: false }], hasWorkshop: false, accountUrl: null };
  const en = orderEmail("paid", order, "en", "Studio");
  assert(!en.html.includes("<b>Sara") && en.html.includes("&lt;b&gt;Sara"));
  assert(!en.html.includes("<i>more") && en.html.includes("Kit &amp;"));
  assert(en.html.includes("OMR 11.000") && en.html.includes("−OMR 1.000"));
  assert(en.text.includes("Kit & <i>more</i> × 2"), "the text version stays plain");
  const ar = orderEmail("paid", order, "ar", "Studio");
  assert(ar.html.includes('dir="rtl"') && ar.html.includes("تم تأكيد الدفع"));
  const link = renderEmail({ lang: "en", siteName: "S", subject: "s", heading: "h", paragraphs: [], button: { label: "go", url: 'https://x.test/?a=1&b="2"' } });
  assert(link.html.includes("a=1&amp;b=&quot;2&quot;"));
});

test("mail settings are for owners and administrators only", () => {
  for (const [role, map] of Object.entries(ROLE_PRESETS)) assert.equal(map.email !== "none", role === "owner" || role === "admin", role);
});

/** A small mail server that takes everything and remembers it. */
function mailServer() {
  const received: { to: string[]; data: string }[] = [];
  const auth: string[] = [];
  const sockets = new Set<Socket>();
  const server = createNet((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let buffer = "";
    let inData = false;
    let current: { to: string[]; data: string } = { to: [], data: "" };
    socket.write("220 test ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      while (true) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end === -1) return;
          current.data = buffer.slice(0, end);
          received.push(current);
          buffer = buffer.slice(end + 5);
          inData = false;
          socket.write("250 ok\r\n");
          continue;
        }
        const i = buffer.indexOf("\r\n");
        if (i === -1) return;
        const line = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO")) socket.write("250-test\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (upper.startsWith("AUTH")) { auth.push(Buffer.from(line.split(" ")[2] ?? "", "base64").toString()); socket.write("235 ok\r\n"); }
        else if (upper.startsWith("MAIL")) { current = { to: [], data: "" }; socket.write("250 ok\r\n"); }
        else if (upper.startsWith("RCPT")) { current.to.push(line.match(/<(.+)>/)?.[1] ?? ""); socket.write("250 ok\r\n"); }
        else if (upper.startsWith("DATA")) { inData = true; socket.write("354 go\r\n"); }
        else if (upper.startsWith("QUIT")) { socket.write("221 bye\r\n"); socket.end(); }
        else socket.write("250 ok\r\n");
      }
    });
  });
  return { server, received, auth, close: () => { for (const s of sockets) s.destroy(); return new Promise((r) => server.close(r)); } };
}

/** Message bodies arrive encoded; this reads them back. */
const decoded = (data: string) => data.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

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

// Run `npm run build` first. Real production server talking to a local mail server.
test("emails through a real SMTP conversation", { timeout: 120_000 }, async (t) => {
  const scratch = await mkdtemp(path.join(tmpdir(), "zahra-email-"));
  const db = createClient({ url: `file:${path.join(scratch, "test.db")}` });
  await migrate(drizzle(db), { migrationsFolder: path.join(projectRoot, "db/migrations") });
  const mail = mailServer();
  await new Promise<void>((r) => mail.server.listen(0, "127.0.0.1", r));
  const smtpPort = (mail.server.address() as { port: number }).port;
  const probe = createNet();
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
    await mail.close();
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
  const row = async (sql: string, ...args: (string | number)[]) => (await db.execute({ sql, args })).rows[0];
  const waitFor = async (count: number, what: string) => {
    for (const until = Date.now() + 8000; mail.received.length < count;) {
      assert(Date.now() < until, `${what}: expected ${count} emails, got ${mail.received.length}\n${log}`);
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  const hash = await hashPassword(PASSWORD);
  await db.execute({ sql: "INSERT INTO admin_users (email,name,role,password_hash) VALUES ('owner@example.test','Owner','owner',?),('sales@example.test','Sales','sales',?)", args: [hash, hash] });
  await db.execute({ sql: "INSERT INTO customers (email,name,password_hash) VALUES ('buyer@example.test','Sara',?)", args: [hash] });
  const signIn = async (email: string) => {
    const jar = new Jar();
    await post(await readForm("/admin/login", jar, 'input[name="password"]'), jar, { email, password: PASSWORD });
    return jar;
  };
  const owner = await signIn("owner@example.test");
  const sales = await signIn("sales@example.test");
  const settings = { host: "127.0.0.1", port: String(smtpPort), security: "none", username: "mailer", fromName: "Zahra Studio", fromEmail: "shop@example.test", adminEmails: "studio@example.test", customerEmails: "on", adminAlerts: "on" };

  await t.test("with sending off, nothing goes out and the forgot page stays on WhatsApp", async () => {
    assert(!(await (await request("/en/forgot-password", new Jar())).text()).includes('name="email"'));
    await db.execute("INSERT INTO orders (id,number,customer_name,email,phone,currency,subtotal,total) VALUES (1,'ZDS-1','Sara','buyer@example.test','91234567','OMR',5,5)");
    await post(await readForm("/admin/orders/1", owner, 'select[name="status"], input[name="id"]'), owner, { id: "1", status: "shipped" });
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(mail.received.length, 0);
  });

  await t.test("settings: encrypted password, never back to the browser, owners only", async () => {
    assert.equal((await request("/admin/email", sales)).status, 307);
    const form = await readForm("/admin/email", owner, 'input[name="host"]');
    await post(form, owner, { ...settings, enabled: "on", host: "", password: SMTP_PASSWORD });
    assert.equal(await row("SELECT value FROM settings WHERE key='email'"), undefined, "on without a server is refused");
    const denied = await post(form, sales, { ...settings, password: "x" });
    assert.equal(new URL(denied.headers.get("location")!, base).pathname, "/admin/forbidden");
    await post(form, owner, { ...settings, password: SMTP_PASSWORD });
    assert(!String((await row("SELECT value FROM settings WHERE key='email'")).value).includes(SMTP_PASSWORD));
    const html = await (await request("/admin/email", owner)).text();
    assert(html.includes("shop@example.test") && !html.includes(SMTP_PASSWORD));
  });

  await t.test("the test button reports success and a server's refusal", async () => {
    const form = await readForm("/admin/email", owner, 'input[name="to"]');
    const ok = await (await post(form, owner, { to: "me@example.test" })).text();
    assert(ok.includes("me@example.test"));
    await waitFor(1, "test email");
    assert.deepEqual(mail.received[0].to, ["me@example.test"]);
    assert(mail.auth.some((a) => a.includes(SMTP_PASSWORD)), "the decrypted password reaches the server");
    assert(/From: "?Zahra Studio"? <shop@example.test>/.test(mail.received[0].data));
  });

  const save = await readForm("/admin/email", owner, 'input[name="host"]');
  await post(save, owner, { ...settings, enabled: "on", password: "" });
  assert(mail.auth.length > 0);

  await t.test("order emails go out once per real change, in the customer's language", async () => {
    const start = mail.received.length;
    await db.execute("INSERT INTO orders (id,number,customer_name,email,phone,currency,subtotal,total,locale) VALUES (2,'ZDS-2','<b>Sara</b>','ar@example.test','91234567','OMR',5,5,'ar')");
    await db.execute("INSERT INTO order_items (order_id,slug,name,unit_price,quantity) VALUES (2,'kit','Kit',5,1)");
    const form = await readForm("/admin/orders/2", owner, 'select[name="status"], input[name="id"]');
    await post(form, owner, { id: "2", status: "shipped" });
    await waitFor(start + 1, "shipped");
    const message = mail.received[start];
    assert.deepEqual(message.to, ["ar@example.test"]);
    assert(message.data.includes("Content-Type: text/html"));
    await post(form, owner, { id: "2", status: "shipped" });
    await post(form, owner, { id: "2", status: "processing" });
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(mail.received.length, start + 1, "no email without a change, nor for an internal status");

    await post(form, owner, { id: "2", status: "paid" });
    await waitFor(start + 3, "paid: customer and studio");
    assert(mail.received.slice(start + 1).some((m) => m.to.includes("studio@example.test")));
    assert(String((await row("SELECT kind AS v FROM email_log ORDER BY id DESC LIMIT 1")).v).length > 0);
  });

  await t.test("a payment reported twice at the same moment sends one email", async () => {
    const payments = await readForm("/admin/payments", owner, 'input[name="amwal_merchantId"]');
    await post(payments, owner, { active: "amwalpay", amwal_environment: "uat", amwal_merchantId: "1", amwal_terminalId: "2", amwal_secretKey: AMWAL_KEY });
    await db.execute("INSERT INTO orders (id,number,customer_name,email,phone,currency,subtotal,total,payment_reference,payment_gateway) VALUES (5,'ZDS-5','Sara','twice@example.test','91234567','OMR',5,5,'R5','amwalpay')");
    const query: Record<string, string> = { amount: "5.000", currencyId: "512", customerId: "null", customerTokenId: "null", merchantReference: "R5", responseCode: "00", transactionId: "T5", transactionTime: "now" };
    query.secureHashValue = signAmwalFields(callbackFields(query, "1", "2"), AMWAL_KEY);
    const route = `/en/checkout/result?${new URLSearchParams(query)}`;
    await Promise.all([request(route, new Jar()), request(route, new Jar()), request(route, new Jar())]);
    await new Promise((r) => setTimeout(r, 800));
    assert.equal((await row("SELECT status AS v FROM orders WHERE id=5")).v, "paid");
    assert.equal(mail.received.filter((m) => m.to.includes("twice@example.test")).length, 1);
  });

  await t.test("the forgot-password form answers the same for everyone and only mails real accounts", async () => {
    const start = mail.received.length;
    const visitor = new Jar();
    const form = await readForm("/en/forgot-password", visitor, 'input[name="email"]');
    const unknown = await (await post(form, visitor, { email: "nobody@example.test" })).text();
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(mail.received.length, start, "no mail for an unknown address");
    const known = await (await post(form, visitor, { email: "BUYER@example.test" })).text();
    const notice = (html: string) => load(html)('[role="status"]').text();
    assert.equal(notice(unknown), notice(known));
    assert(notice(known).length > 0);
    await waitFor(start + 1, "reset");
    const body = decoded(mail.received[start].data);
    const url = body.match(/https?:\/\/[^\s"<>]+reset-password\?token=3D[^\s"<>]+|https?:\/\/[^\s"<>]+reset-password\?token=[A-Za-z0-9_-]{43}/)?.[0];
    assert(url, "the link is in the message");
    assert(url.startsWith(base), "built from APP_URL, never from a request header");
    const token = url.split("token=").pop()!;
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(await row("SELECT id FROM customer_password_resets WHERE id=?", token), undefined, "only the hash is stored");
    assert.equal(await row("SELECT id FROM email_log WHERE subject LIKE ?", `%${token}%`), undefined);

    const reset = new Jar();
    const change = await readForm(`/en/reset-password?token=${token}`, reset, 'input[name="token"]');
    assert.equal((await post(change, reset, { next: "Another-password-1", confirm: "Another-password-1" })).status, 303);
    await waitFor(start + 2, "changed notice");
    assert.deepEqual(mail.received[start + 1].to, ["buyer@example.test"]);

    await db.execute("UPDATE customers SET disabled_at=unixepoch() WHERE email='buyer@example.test'");
    const before = mail.received.length;
    await post(form, visitor, { email: "buyer@example.test" });
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(mail.received.length, before, "a suspended account gets no link");
  });

  await t.test("a dead mail server is recorded and breaks nothing", async () => {
    const form = await readForm("/admin/email", owner, 'input[name="host"]');
    await post(form, owner, { ...settings, port: "1", enabled: "on", password: "" });
    await db.execute("INSERT INTO orders (id,number,customer_name,email,phone,currency,subtotal,total) VALUES (3,'ZDS-3','Sara','x@example.test','91234567','OMR',5,5)");
    const update = await readForm("/admin/orders/3", owner, 'select[name="status"], input[name="id"]');
    const started = Date.now();
    await post(update, owner, { id: "3", status: "shipped" });
    assert(Date.now() - started < 5000, "the admin doesn't wait for the mail server");
    assert.equal((await row("SELECT status AS v FROM orders WHERE id=3")).v, "shipped");
    for (const until = Date.now() + 8000; ;) {
      const failed = await row("SELECT error AS v FROM email_log WHERE error IS NOT NULL LIMIT 1");
      if (failed) break;
      assert(Date.now() < until, "the failure reaches the log");
      await new Promise((r) => setTimeout(r, 100));
    }
    const page = await (await request("/admin/email", owner)).text();
    assert(page.includes("ZDS-3"));
    const refused = await readForm("/admin/email", owner, 'input[name="to"]');
    assert((await (await post(refused, owner, { to: "me@example.test" })).text()).includes('role="alert"'));
  });
});
