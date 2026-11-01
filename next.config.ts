import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The static mirror is only used by the extraction script.
  outputFileTracingExcludes: {
    "/*": ["./theme/**/*", "./storage/**/*", "./.env*"],
  },
  images: {
    // every image is served from this site (public/ and storage/uploads) – no remote hosts
    qualities: [75, 90],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        source: "/:lang(en|ar)/:page(account|login|register)",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        // workshop pages and order history inside the account
        source: "/:lang(en|ar)/account/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        // the service worker must never be served stale, or updates would not reach visitors
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  experimental: {
    // uploads go through Server Actions: product images, workshop files (admin) and the
    // Customized Pattern / Print My Design attachments (max 25 MB per request, checked in lib/requests.ts)
    serverActions: { bodySizeLimit: "30mb" },
    // the store ([lang]) and the admin have separate root layouts
    globalNotFound: true,
  },
};

export default nextConfig;
