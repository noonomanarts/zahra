import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
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
import { getDictionary } from "../lib/i18n/dictionaries";
import { verifyPassword } from "../lib/password";

// Run `npm run build` first. These tests use the real production server and
// native form submissions, with a disposable database and blank admin credentials.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = getDictionary("en").auth.errors;
const cookieName = "zds_customer";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

class CookieJar {
  values = new Map<string, string>();

  read(response: Response) {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const delimiter = pair.indexOf("=");
      const name = pair.slice(0, delimiter);
      const value = pair.slice(delimiter + 1);
      if (!value || /max-age=0(?:;|$)/i.test(cookie)) this.values.delete(name);
      else this.values.set(name, value);
    }
  }

  header() {
    return [...this.values].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

async function availablePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function stopServer(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => child.kill("SIGKILL"), 5_000);
    child.once("exit", () => { clearTimeout(timeout); resolve(); });
    child.kill("SIGTERM");
  });
}

function expectRedirect(response: Response, pathname: string) {
  assert([303, 307, 308].includes(response.status), `Expected redirect to ${pathname}, received ${response.status}`);
  const location = response.headers.get("location");
  assert(location, "Redirect response must include Location");
  assert.equal(new URL(location, "http://localhost").pathname, pathname);
}

test("customer accounts through native production HTTP forms", { timeout: 120_000 }, async (t) => {
  const scratch = await mkdtemp(path.join(tmpdir(), "zahra-customer-auth-"));
  const database = createClient({ url: `file:${path.join(scratch, "test.db")}` });
  const server = { child: undefined as ChildProcess | undefined };
  t.after(async () => {
    if (server.child) await stopServer(server.child);
    database.close();
    await rm(scratch, { recursive: true, force: true });
  });

  await migrate(drizzle(database), { migrationsFolder: path.join(projectRoot, "db/migrations") });
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  let serverLog = "";
  const child = spawn(process.execPath, [path.join(projectRoot, "node_modules/next/dist/bin/next"), "start", projectRoot, "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: projectRoot,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      DATABASE_URL: `file:${path.join(scratch, "test.db")}`,
      APP_URL: base,
      ADMIN_EMAIL: "",
      ADMIN_PASSWORD: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.child = child;
  child.stdout?.on("data", (chunk) => { serverLog = (serverLog + chunk.toString()).slice(-12_000); });
  child.stderr?.on("data", (chunk) => { serverLog = (serverLog + chunk.toString()).slice(-12_000); });

  const readyBy = Date.now() + 40_000;
  while (true) {
    assert.equal(child.exitCode, null, `Production server exited early:\n${serverLog}`);
    try {
      const response = await fetch(`${base}/api/customer`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) break;
    } catch { /* The server has not opened its socket yet. */ }
    assert(Date.now() < readyBy, `Production server failed to become ready:\n${serverLog}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const jar = new CookieJar();
  async function request(route: string, init: RequestInit = {}, cookies = jar) {
    const headers = new Headers(init.headers);
    if (cookies.values.size) headers.set("Cookie", cookies.header());
    const response = await fetch(`${base}${route}`, { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(15_000) }).catch((cause: unknown) => {
      throw new Error(`${init.method ?? "GET"} ${route} failed:\n${serverLog}`, { cause });
    });
    cookies.read(response);
    return response;
  }

  async function submit(route: string, fields: Record<string, string>, cookies = jar) {
    const page = await request(route, {}, cookies);
    assert.equal(page.status, 200, `Could not load form ${route}`);
    const $ = load(await page.text());
    const form = $("form").filter((_, element) => $(element).find('input[name^="$ACTION_"]').length > 0).first();
    assert.equal(form.length, 1, `No progressive-enhancement Server Action form on ${route}`);
    const body = new FormData();
    form.find('input[type="hidden"][name]').each((_, element) => {
      const input = $(element);
      body.append(input.attr("name")!, input.attr("value") ?? "");
    });
    assert([...body.keys()].some((key) => key.startsWith("$ACTION_")), "Missing native React Server Action fields");
    for (const [name, value] of Object.entries(fields)) body.set(name, value);
    const action = new URL(form.attr("action") || route, base);
    assert.equal(action.origin, base);
    return request(`${action.pathname}${action.search}`, { method: "POST", headers: { Origin: base }, body }, cookies);
  }

  async function expectFormError(response: Response, message: string) {
    assert.equal(response.status, 200);
    const $ = load(await response.text());
    assert.equal($("[role=alert]").text().trim(), message);
  }

  async function step(label: string, run: () => Promise<void>) {
    let completed = false;
    await t.test(label, async () => {
      await run();
      completed = true;
    });
    assert(completed, `Stopped dependent integration steps after failure: ${label}`);
  }

  const suffix = randomBytes(6).toString("hex");
  const name = `Integration Customer ${suffix}`;
  const email = `customer-${suffix}@example.test`;
  const password = "Valid-password-2026!";
  const registration = { name, email, password, confirmPassword: password };

  await step("server validation rejects malformed registration and mismatched confirmation", async () => {
    await expectFormError(await submit("/en/register", { ...registration, confirmPassword: "Another-password" }), errors.passwordMismatch);
    await expectFormError(await submit("/en/register", { ...registration, email: `name-${suffix}@example.test`, name: "A" }), errors.invalidName);
    await expectFormError(await submit("/en/register", { ...registration, email: "invalid-email" }), errors.invalidEmail);
    await expectFormError(await submit("/en/register", { ...registration, email: `password-${suffix}@example.test`, password: "short", confirmPassword: "short" }), errors.invalidPassword);
    assert.equal((await database.execute("SELECT count(*) AS total FROM customers")).rows[0].total, 0);
  });

  let firstToken = "";
  await step("registration normalizes data and creates a private, hashed customer session", async () => {
    const response = await submit("/en/register", { ...registration, name: `  Integration   Customer ${suffix}  `, email: `  ${email.toUpperCase()}  ` });
    expectRedirect(response, "/en/account");
    const sessionCookie = response.headers.getSetCookie().find((value) => value.startsWith(`${cookieName}=`));
    assert(sessionCookie, "Registration must set the customer session cookie");
    assert.match(sessionCookie, /HttpOnly/i);
    assert.match(sessionCookie, /Secure/i);
    assert.match(sessionCookie, /SameSite=Lax/i);
    firstToken = jar.values.get(cookieName)!;
    assert.match(firstToken, /^[A-Za-z0-9_-]{43}$/);

    const account = await request("/en/account");
    assert.equal(account.status, 200);
    assert.match(account.headers.get("cache-control") ?? "", /private.*no-store/);
    const $ = load(await account.text());
    assert.deepEqual($("dl dd").map((_, element) => $(element).text()).get(), [name, email]);

    const state = await request("/api/customer");
    assert.equal(state.status, 200);
    assert.match(state.headers.get("cache-control") ?? "", /private.*no-store/);
    assert.match(state.headers.get("vary") ?? "", /Cookie/i);
    assert.deepEqual(await state.json(), { customer: { name, email } });

    const storedCustomer = (await database.execute({ sql: "SELECT * FROM customers WHERE email = ?", args: [email] })).rows[0];
    assert.equal(storedCustomer.name, name);
    assert.notEqual(storedCustomer.password_hash, password);
    assert(await verifyPassword(password, String(storedCustomer.password_hash)));
    const session = (await database.execute("SELECT * FROM customer_sessions")).rows[0];
    assert.equal(session.id, hashToken(firstToken));
    assert.notEqual(session.id, firstToken);
    assert.equal((await database.execute("SELECT count(*) AS total FROM admin_users")).rows[0].total, 0);

    const home = await request("/en");
    assert.equal(home.status, 200);
    const homeHtml = await home.text();
    assert(!homeHtml.includes(name), "Static home HTML must not contain private customer names");
    assert(!homeHtml.includes(email), "Static home HTML must not contain private customer emails");
  });

  await step("customer cookies cannot authorize administrator routes", async () => {
    expectRedirect(await request("/admin"), "/admin/login");
    const forgedAdmin = new CookieJar();
    forgedAdmin.values.set(cookieName, firstToken);
    forgedAdmin.values.set("zds_admin", firstToken);
    expectRedirect(await request("/admin", {}, forgedAdmin), "/admin/login");
  });

  await step("logout revokes the stored session and replaying it cannot restore access", async () => {
    expectRedirect(await submit("/en/account", {}), "/en");
    assert(!jar.values.has(cookieName));
    assert.equal((await database.execute("SELECT count(*) AS total FROM customer_sessions")).rows[0].total, 0);
    assert.deepEqual(await (await request("/api/customer")).json(), { customer: null });
    const replay = new CookieJar();
    replay.values.set(cookieName, firstToken);
    expectRedirect(await request("/en/account", {}, replay), "/en/login");
  });

  await step("duplicate normalized emails fail without creating a second account", async () => {
    await expectFormError(await submit("/en/register", { ...registration, email: ` ${email.toUpperCase()} ` }), errors.registrationFailed);
    assert.equal((await database.execute("SELECT count(*) AS total FROM customers")).rows[0].total, 1);
    assert(!jar.values.has(cookieName));
  });

  await step("wrong and unknown credentials share an error; valid login rotates the token", async () => {
    await expectFormError(await submit("/en/login", { email, password: "Wrong-password-2026" }), errors.invalidCredentials);
    await expectFormError(await submit("/en/login", { email: `unknown-${suffix}@example.test`, password }), errors.invalidCredentials);
    expectRedirect(await submit("/en/login", { email: ` ${email.toUpperCase()} `, password }), "/en/account");
    assert.notEqual(jar.values.get(cookieName), firstToken);
    assert.deepEqual(await (await request("/api/customer")).json(), { customer: { name, email } });
  });

  await step("expired and forged sessions are rejected and expired records are removed", async () => {
    const expiredToken = jar.values.get(cookieName)!;
    await database.execute({ sql: "UPDATE customer_sessions SET expires_at = ? WHERE id = ?", args: [Math.floor(Date.now() / 1_000) - 60, hashToken(expiredToken)] });
    assert.deepEqual(await (await request("/api/customer")).json(), { customer: null });
    assert.equal((await database.execute("SELECT count(*) AS total FROM customer_sessions")).rows[0].total, 0);
    expectRedirect(await request("/en/account"), "/en/login");

    const forged = new CookieJar();
    forged.values.set(cookieName, randomBytes(32).toString("base64url"));
    assert.deepEqual(await (await request("/api/customer", {}, forged)).json(), { customer: null });
    expectRedirect(await request("/en/account", {}, forged), "/en/login");
  });

  await step("Arabic forms preserve the locale through login and logout", async () => {
    expectRedirect(await submit("/ar/login", { email, password }), "/ar/account");
    const account = await request("/ar/account");
    assert.equal(account.status, 200);
    assert.match(await account.text(), /dir="rtl"/);
    expectRedirect(await submit("/ar/account", {}), "/ar");
  });

  await step("repeated failed logins are rate limited", async () => {
    const limitedEmail = `limited-${suffix}@example.test`;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expectFormError(await submit("/en/login", { email: limitedEmail, password: "Wrong-password-2026" }), errors.invalidCredentials);
    }
    await expectFormError(await submit("/en/login", { email: limitedEmail, password: "Wrong-password-2026" }), errors.rateLimited);
  });
});
