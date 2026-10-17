/* Zahra's Design Studio – service worker (no build step, no dependencies).
 *
 * Strategies
 *   pages (navigations)        network-first (4 s timeout) → cached copy → offline page of that language
 *   /_next/static/*            cache-first (file names are content-hashed)
 *   images, fonts, icons       stale-while-revalidate, capped
 *   admin, api, checkout, account/auth, RSC  never cached
 */
const VERSION = "v2";
const PRECACHE = `zds-precache-${VERSION}`;
const PAGES = `zds-pages-${VERSION}`;
const STATIC = `zds-static-${VERSION}`;
const MEDIA = `zds-media-${VERSION}`;
const CACHES = [PRECACHE, PAGES, STATIC, MEDIA];

const LANGS = ["en", "ar"];
const OFFLINE = (lang) => `/${lang}/offline`;
const PRECACHE_URLS = [
  ...LANGS.flatMap((l) => [OFFLINE(l), `/${l}`]),
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/fonts/myriadpro-regular.woff",
  "/fonts/vip-hakm-light.woff",
  "/fonts/autography.woff",
];
const LIMITS = { [PAGES]: 40, [MEDIA]: 160 };
const NEVER = /^\/(admin|api)(\/|$)|^\/(en|ar)\/(checkout|account|login|register)(\/|$)/;

// ---------- install: precache the shell + the CSS/JS the offline pages need ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await cache.addAll(PRECACHE_URLS);
      // the offline pages must render with their styles even before anything else was visited
      const assets = new Set();
      for (const lang of LANGS) {
        const res = await cache.match(OFFLINE(lang));
        const html = res ? await res.text() : "";
        for (const [, url] of html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+)"/g)) assets.add(url);
      }
      const staticCache = await caches.open(STATIC);
      await Promise.all([...assets].map((u) => staticCache.add(u).catch(() => {})));
      // Replace v1 promptly so its broad page cache cannot retain new account pages.
      if (await caches.has("zds-precache-v1")) await self.skipWaiting();
    })(),
  );
});

// ---------- activate: drop old versions, enable navigation preload ----------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith("zds-") && !CACHES.includes(key)) await caches.delete(key);
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

// the page asks the waiting worker to take over after the visitor accepts the update
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// ---------- fetch ----------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.test(url.pathname) || url.pathname === "/sw.js") return;
  // React Server Component payloads of client-side navigations: always live
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") return event.respondWith(page(event));
  if (url.pathname.startsWith("/_next/static/")) return event.respondWith(cacheFirst(request, STATIC));
  if (/^\/(_next\/image|images|uploads|icons|fonts|screenshots)(\/|$)/.test(url.pathname) || request.destination === "image" || request.destination === "font") {
    return event.respondWith(staleWhileRevalidate(event, MEDIA));
  }
});

async function page(event) {
  const { request } = event;
  const cache = await caches.open(PAGES);
  try {
    const response = await withTimeout((async () => (await event.preloadResponse) || fetch(request))(), 4000);
    const privateResponse = /(?:private|no-store)/i.test(response.headers.get("Cache-Control") || "");
    if (response.ok && response.type === "basic" && !response.redirected && !privateResponse) {
      event.waitUntil(cache.put(request, response.clone()).then(() => trim(PAGES)));
    }
    return response;
  } catch {
    const cached = (await cache.match(request, { ignoreSearch: true })) || (await caches.match(request, { ignoreSearch: true }));
    if (cached) return cached;
    const lang = LANGS.find((l) => new URL(request.url).pathname.startsWith(`/${l}`)) || "en";
    return (await caches.match(OFFLINE(lang))) || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function cacheFirst(request, name) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(name)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(event, name) {
  const cache = await caches.open(name);
  const cached = await cache.match(event.request);
  const network = fetch(event.request)
    .then((response) => {
      if (response.ok) cache.put(event.request, response.clone()).then(() => trim(name));
      return response;
    })
    .catch(() => cached);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return network;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

async function trim(name) {
  const limit = LIMITS[name];
  if (!limit) return;
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(key);
}
