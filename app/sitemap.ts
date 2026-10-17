import type { MetadataRoute } from "next";
import { listCategories, listPageSlugs, listProducts, listTags } from "@/lib/data";
import { LOCALES } from "@/lib/i18n/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "https://zahrasdesignstudio.com";
  const [pages, products, categories, tags] = await Promise.all([listPageSlugs(), listProducts("en"), listCategories("en"), listTags("en")]);
  const paths = [
    "",
    "/shop",
    ...pages.map((s) => `/${s}`),
    ...products.map((p) => `/products/${p.slug}`),
    ...categories.map((c) => `/categories/${c.slug}`),
    ...tags.map((t) => `/tags/${t.slug}`),
  ];
  return paths.map((path) => ({
    url: `${base}/en${path}`,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${path}`])) },
  }));
}
