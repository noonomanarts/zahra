import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "https://zahrasdesignstudio.com";
  const privatePages = ["account", "cart", "checkout", "login", "register", "forgot-password", "reset-password", "downloads", "offline"];
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", ...["en", "ar"].flatMap((lang) => privatePages.map((page) => `/${lang}/${page}`))],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
