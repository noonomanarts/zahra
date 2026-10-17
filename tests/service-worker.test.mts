import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

function worker({ oldVersion = false } = {}) {
  const listeners = new Map<string, (event: unknown) => void>();
  const writes: string[] = [];
  let activated = 0;
  const cache = {
    addAll: async () => {},
    add: async () => {},
    match: async () => ({ text: async () => "" }),
    put: async (request: { url: string }) => { writes.push(request.url); },
    keys: async () => [],
  };
  vm.runInNewContext(source, {
    self: {
      location: { origin: "https://studio.test" },
      addEventListener: (name: string, callback: (event: unknown) => void) => listeners.set(name, callback),
      skipWaiting: async () => { activated += 1; },
    },
    caches: { open: async () => cache, has: async () => oldVersion },
    URL, Response, setTimeout, clearTimeout,
    fetch: () => { throw new Error("Unexpected network access"); },
  });
  return { listeners, writes, activated: () => activated };
}

test("customer and admin routes bypass offline page caching", () => {
  const { listeners } = worker();
  const paths = ["/api/customer", "/admin", "/admin/login", ...["en", "ar"].flatMap((lang) => [
    `/${lang}/account`, `/${lang}/account/`, `/${lang}/login`, `/${lang}/register`, `/${lang}/checkout`,
  ])];
  for (const path of paths) {
    let intercepted = false;
    listeners.get("fetch")!({
      request: { method: "GET", url: `https://studio.test${path}`, mode: "navigate", headers: new Headers() },
      respondWith: () => { intercepted = true; },
    });
    assert.equal(intercepted, false, `${path} must go directly to the server`);
  }
});

test("private/no-store responses never enter the public page cache", async () => {
  for (const cacheControl of ["private, no-cache", "no-store", "public, max-age=60"]) {
    const { listeners, writes } = worker();
    const pending: Promise<unknown>[] = [];
    const response = new Response("page", { headers: { "Cache-Control": cacheControl } });
    Object.defineProperty(response, "type", { value: "basic" });
    let handled: Promise<Response> | undefined;
    listeners.get("fetch")!({
      request: { method: "GET", url: "https://studio.test/en/shop", mode: "navigate", headers: new Headers() },
      preloadResponse: Promise.resolve(response),
      respondWith: (promise: Promise<Response>) => { handled = promise; },
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    });
    assert.equal(await handled, response);
    await Promise.all(pending);
    assert.equal(writes.length, cacheControl.startsWith("public") ? 1 : 0, cacheControl);
  }
});

test("v1 upgrade activates promptly to discard its broad page cache", async () => {
  for (const oldVersion of [true, false]) {
    const harness = worker({ oldVersion });
    let installed: Promise<void> | undefined;
    harness.listeners.get("install")!({ waitUntil: (promise: Promise<void>) => { installed = promise; } });
    await installed;
    assert.equal(harness.activated(), oldVersion ? 1 : 0);
  }
});
