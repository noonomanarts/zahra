/** Shared PWA settings (manifest, viewport, service worker). */
export const PWA = {
  themeColor: "#a46e62", // top bar of the storefront
  backgroundColor: "#f6ece9", // splash screen
} as const;
// cache versions live in public/sw.js (VERSION); bump it to drop every client's runtime caches
