import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createClient } from "@libsql/client";
import { load } from "cheerio";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { orderEmail } from "../lib/email-templates";
import { hashPassword } from "../lib/password";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASSWORD = "Fixture-password-2026!";

test("the paid email offers the files, or says they come by hand", () => {
  const order = { number: "Z-1", customerName: "Sara", subtotal: 5, discount: 0, shipping: 0, total: 5, items: [{ name: "Pattern", quantity: 1, unitPrice: 5, digital: true }], hasWorkshop: false, accountUrl: "https://x.test/en/account" };
  const ready = orderEmail("paid", { ...order, downloadUrl: "https://x.test/en/downloads/1?key=abc" }, "en", "S");
  assert(ready.html.includes("downloads/1?key=abc") && ready.text.includes("Download your files"));
  const manual = orderEmail("paid", { ...order, manualDelivery: true }, "en", "S");
  assert(manual.text.includes("will be sent") && !manual.html.includes("downloads/"));
  assert(!orderEmail("received", { ...order, downloadUrl: "https://x.test/d" }, "en", "S").html.includes("x.test/d"), "no files before payment");
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
test("digital delivery", { timeout: 120_000 }, async (t) => {
  const scratch = await mkdtemp(path.join(tmpdir(), "zahra-downloads-"));
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
  const post = (form: { route: string; body: FormData }, jar: Jar, fields: Record<string, string | File> = {}) => {
    const body = new FormData();
    for (const [k, v] of form.body) body.append(k, v);
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    return request(form.route, jar, { method: "POST", headers: { Origin: base }, body });
  };
  const row = async (sql: string, ...args: (string | number)[]) => (await db.execute({ sql, args })).rows[0];
  const hash = await hashPassword(PASSWORD);
  for (const [email, role] of [["owner@example.test", "owner"], ["content@example.test", "content"]]) {
    await db.execute({ sql: "INSERT INTO admin_users (email,name,role,password_hash) VALUES (?,?,?,?)", args: [email, email.split("@")[0], role, hash] });
  }
  await db.execute({ sql: "INSERT INTO customers (id,email,name,password_hash) VALUES (1,'buyer@example.test','Buyer',?),(2,'other@example.test','Other',?)", args: [hash, hash] });
  const signIn = async (route: string, email: string) => {
    const jar = new Jar();
    await post(await readForm(route, jar, 'input[name="password"]'), jar, { email, password: PASSWORD });
    return jar;
  };
  const owner = await signIn("/admin/login", "owner@example.test");
  const content = await signIn("/admin/login", "content@example.test");
  const buyer = await signIn("/en/login", "buyer@example.test");
  const other = await signIn("/en/login", "other@example.test");
  const anon = new Jar();
  const productFields = { name_en: "Secret Pattern", name_ar: "", slug: "secret-pattern", sku: "P-X", price: "4", regularPrice: "", unitCost: "", description_en: "x", description_ar: "", digital: "on", published: "on", inStock: "on", kind: "product", images: "[]" };
  const PDF = new File(["%PDF-private-content"], "lesson.pdf", { type: "application/pdf" });
  let pid = 0;
  let fileId = "";

  await t.test("files are uploaded privately and only PDF or ZIP is accepted", async () => {
    const form = await readForm("/admin/products/new", owner, 'input[name="slug"]');
    const bad = await post(form, owner, { ...productFields, digitalFiles: "[]", newDigitalFiles: new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }) });
    assert.equal(bad.status, 200);
    assert.equal(await row("SELECT id FROM products WHERE slug='secret-pattern'"), undefined);
    const good = await post(form, owner, { ...productFields, digitalFiles: "[]", newDigitalFiles: PDF });
    assert.equal(good.status, 303, "a new product redirects to its page");
    const saved = await row("SELECT id,digital_files AS f FROM products WHERE slug='secret-pattern'");
    pid = Number(saved.id);
    const files = JSON.parse(String(saved.f));
    assert.equal(files.length, 1);
    fileId = files[0].id;
    assert(!(await readdir(path.join(scratch, "uploads")).catch(() => [] as string[])).includes(files[0].file), "not in public uploads");
    assert.equal((await request(`/uploads/${files[0].file}`, anon)).status, 404);
    // shop pages know a file exists, never where it is
    const page = await (await request("/en/products/secret-pattern", anon)).text();
    assert(page.includes("instant download") && !page.includes(files[0].file) && !page.includes(fileId));
  });

  const order = async (id: number, status: string, customerId: number | null = null, paidDaysAgo = 0) => {
    await db.execute({ sql: "INSERT INTO orders (id,number,customer_name,email,phone,currency,subtotal,total,status,customer_id,paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,unixepoch()-?)", args: [id, `Z-${id}`, "Buyer", "b@example.test", "91234567", "OMR", 4, 4, status, customerId, paidDaysAgo * 86400] });
    await db.execute({ sql: "INSERT INTO order_items (order_id,product_id,slug,name,unit_price,quantity,digital) VALUES (?,?,'secret-pattern','Secret Pattern',4,1,1)", args: [id, pid] });
  };
  const file = (id: number, key = "") => `/api/downloads/${id}/${pid}/${fileId}${key ? `?key=${key}` : ""}`;
  const keyOf = async (id: number) => {
    // the admin's order page holds the signed link
    const html = await (await request(`/admin/orders/${id}`, owner)).text();
    const href = load(html)('a[href*="/downloads/"]').attr("href");
    assert(href, "the order page offers the link");
    return new URL(href).searchParams.get("key")!;
  };

  await t.test("the link delivers the real file to a guest, and nothing else", async () => {
    await order(1, "paid");
    const key = await keyOf(1);
    const response = await request(file(1, key), anon);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "%PDF-private-content");
    assert.match(response.headers.get("content-disposition") ?? "", /attachment/);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    const page = await (await request(`/en/downloads/1?key=${key}`, anon)).text();
    assert(page.includes("Secret Pattern") && page.includes(`/api/downloads/1/${pid}/${fileId}?key=`));

    assert.equal((await request(file(1), anon)).status, 403, "no key");
    assert.equal((await request(file(1, "wrong"), anon)).status, 403, "wrong key");
    assert.equal((await request("/en/downloads/1?key=wrong", anon)).status, 404);
    await order(2, "paid");
    assert.equal((await request(file(2, key), anon)).status, 403, "a key opens only its own order");
    await db.execute("INSERT INTO products (id,slug,name,price,digital,digital_files) VALUES (900,'other','Other',1,1,'[{\"id\":\"zz\",\"name\":\"o.pdf\",\"file\":\"products/none.pdf\",\"size\":1}]')");
    assert.equal((await request(`/api/downloads/1/900/zz?key=${key}`, anon)).status, 404, "a product that isn't in the order");
    assert.equal((await request(`/api/downloads/1/${pid}/nope?key=${key}`, anon)).status, 404);
  });

  await t.test("payment is checked every time, and links expire", async () => {
    await order(3, "pending");
    const pendingKey = await (async () => { await db.execute("UPDATE orders SET status='paid' WHERE id=3"); const k = await keyOf(3); await db.execute("UPDATE orders SET status='pending' WHERE id=3"); return k; })();
    assert.equal((await request(file(3, pendingKey), anon)).status, 403, "not paid");
    assert((await (await request(`/en/downloads/3?key=${pendingKey}`, anon)).text()).includes("once the payment is confirmed"));

    await order(4, "paid");
    const key = await keyOf(4);
    assert.equal((await request(file(4, key), anon)).status, 200);
    const cancel = await readForm("/admin/orders/4", owner, 'input[name="id"]');
    await post(cancel, owner, { id: "4", status: "cancelled" });
    assert.equal((await request(file(4, key), anon)).status, 403, "cancelling ends the downloads");

    await order(5, "paid", null, 31);
    const old = await keyOf(5);
    assert.equal((await request(file(5, old), anon)).status, 403);
    assert((await (await request(`/en/downloads/5?key=${old}`, anon)).text()).includes("expired"));
  });

  await t.test("a buyer's account needs no link and has no time limit; other people get nothing", async () => {
    await order(6, "paid", 1, 400);
    assert.equal((await request(file(6), buyer)).status, 200);
    assert.equal((await request(file(6), other)).status, 403);
    assert.equal((await request("/en/downloads/6", other)).status, 404);
    const list = await (await request("/en/account/orders", buyer)).text();
    assert(list.includes('/en/downloads/6"'));
    assert.equal((await request(file(6), content)).status, 403, "staff without access to orders");
    assert.equal((await request(file(6), owner)).status, 200, "staff with access");
  });

  await t.test("the result page offers files only with proof", async () => {
    await order(7, "paid");
    const key = await keyOf(7);
    assert(!(await (await request("/en/checkout/result?ref=Z-7", anon)).text()).includes("/downloads/7"), "an order number alone is guessable");
    assert((await (await request(`/en/checkout/result?ref=Z-7&key=${key}`, anon)).text()).includes("/downloads/7"));
  });

  await t.test("renaming and removing files, and a product with no file raises a notification", async () => {
    const edit = await readForm(`/admin/products/${pid}`, owner, 'input[name="slug"]');
    await post(edit, owner, { ...productFields, id: String(pid), digitalFiles: JSON.stringify([{ id: fileId, name: "Renamed.pdf" }]) });
    assert.equal(JSON.parse(String((await row("SELECT digital_files AS f FROM products WHERE id=?", pid)).f))[0].name, "Renamed.pdf");
    await post(edit, owner, { ...productFields, id: String(pid), digitalFiles: "[]" });
    assert.equal(String((await row("SELECT digital_files AS f FROM products WHERE id=?", pid)).f), "[]");
    assert.equal((await readdir(path.join(scratch, "private/products"))).length, 0, "the stored file is gone too");
    assert.equal((await request(file(1, await (async () => { await db.execute({ sql: "UPDATE products SET digital_files=? WHERE id=?", args: ['[{"id":"a","name":"a.pdf","file":"products/a.pdf","size":1}]', pid] }); const k = await keyOf(1); await db.execute({ sql: "UPDATE products SET digital_files='[]' WHERE id=?", args: [pid] }); return k; })()), anon)).status, 404);

    await db.execute("INSERT INTO orders (id,number,customer_name,email,phone,currency,subtotal,total,status) VALUES (8,'Z-8','Buyer','b@example.test','91234567','OMR',4,4,'pending')");
    await db.execute({ sql: "INSERT INTO order_items (order_id,product_id,slug,name,unit_price,quantity,digital) VALUES (8,?,'secret-pattern','Secret Pattern',4,1,1)", args: [pid] });
    const update = await readForm("/admin/orders/8", owner, 'input[name="id"]');
    await post(update, owner, { id: "8", status: "paid" });
    for (const until = Date.now() + 5000; ;) {
      if (await row("SELECT id FROM admin_notifications WHERE kind='delivery.manual'")) break;
      assert(Date.now() < until, "someone is told to send it by hand");
      await new Promise((r) => setTimeout(r, 60));
    }
  });
});
