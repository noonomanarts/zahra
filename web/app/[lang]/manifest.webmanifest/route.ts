import type { MetadataRoute } from "next";
import { getSite } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LOCALES, dirOf, isLocale } from "@/lib/i18n/config";
import { PWA } from "@/lib/pwa/config";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

/** One installable app (same `id`), with the name, direction and shortcuts of the visitor's language. */
export async function GET(_request: Request, { params }: RouteContext<"/[lang]/manifest.webmanifest">) {
  const { lang } = await params;
  if (!isLocale(lang)) return new Response("Not found", { status: 404 });
  const t = getDictionary(lang);
  const site = await getSite();
  const icon = (src: string, sizes: string, purpose: "any" | "maskable") => ({ src, sizes, type: "image/png", purpose });

  const manifest: MetadataRoute.Manifest & { dir: string; display_override: string[] } = {
    id: "/",
    name: site.name,
    short_name: lang === "ar" ? "زهراء ستوديو" : "Zahra's Studio",
    description: t.meta.description,
    lang,
    dir: dirOf(lang),
    start_url: `/${lang}?source=pwa`,
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "portrait",
    theme_color: PWA.themeColor,
    background_color: PWA.backgroundColor,
    categories: ["shopping", "lifestyle"],
    icons: [
      icon("/icons/icon-192.png", "192x192", "any"),
      icon("/icons/icon-512.png", "512x512", "any"),
      icon("/icons/maskable-192.png", "192x192", "maskable"),
      icon("/icons/maskable-512.png", "512x512", "maskable"),
    ],
    shortcuts: [
      { name: t.nav.shop, short_name: t.nav.shop, url: `/${lang}/shop?source=pwa-shortcut`, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t.cart.title, short_name: t.nav.cart, url: `/${lang}/cart?source=pwa-shortcut`, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    screenshots: [
      { src: `/screenshots/${lang}-wide.png`, sizes: "1280x720", type: "image/png", form_factor: "wide", label: site.name },
      { src: `/screenshots/${lang}-narrow.png`, sizes: "540x1170", type: "image/png", form_factor: "narrow", label: site.name },
    ],
  };

  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
