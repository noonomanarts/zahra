import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    // admin product forms upload images through Server Actions
    serverActions: { bodySizeLimit: "10mb" },
    // the store ([lang]) and the admin have separate root layouts
    globalNotFound: true,
  },
};

export default nextConfig;
