import localFont from "next/font/local";

/* Self-hosted Arabic fonts (SIL Open Font License) – no requests to Google, not even at build time.
   Latin text uses the brand fonts in public/fonts; these only provide the Arabic glyphs. */

export const plexArabic = localFont({
  src: [
    { path: "./plex-arabic-300.woff2", weight: "300" },
    { path: "./plex-arabic-400.woff2", weight: "400" },
    { path: "./plex-arabic-500.woff2", weight: "500" },
    { path: "./plex-arabic-600.woff2", weight: "600" },
    { path: "./plex-arabic-700.woff2", weight: "700" },
  ],
  variable: "--font-plex-arabic",
  display: "swap",
});

export const arefRuqaa = localFont({
  src: [
    { path: "./aref-ruqaa-400.woff2", weight: "400" },
    { path: "./aref-ruqaa-700.woff2", weight: "700" },
  ],
  variable: "--font-ruqaa",
  display: "swap",
});
