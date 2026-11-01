import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { ProductGrid } from "@/components/ProductCard";
import { DEPARTMENTS, SECTION_CATEGORIES, WORKSHOPS_LABEL, WORKSHOPS_PATH } from "@/lib/catalog";
import { listCategories, listShopProducts } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref, pick } from "@/lib/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/shop">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).nav.shop, alternates: { languages: { en: "/en/shop", ar: "/ar/shop" } } } : {};
}

const sectionCategories = new Set(SECTION_CATEGORIES.map((c) => c.slug));

export default async function ShopPage({ params }: PageProps<"/[lang]/shop">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const [categories, products] = await Promise.all([listCategories(lang), listShopProducts(lang)]);
  const themes = categories.filter((c) => !sectionCategories.has(c.slug));
  const crafts = [
    ...DEPARTMENTS.map((d) => ({ label: d.label, href: `/${d.slug}`, intro: d.intro })),
    { label: WORKSHOPS_LABEL, href: WORKSHOPS_PATH, intro: { en: getDictionary("en").workshops.lead, ar: getDictionary("ar").workshops.lead } },
  ];
  // available products first
  const sorted = [...products].sort((a, b) => Number(b.inStock) - Number(a.inStock));

  return (
    <>
      <PageHeader title={t.nav.shop} lang={lang}>
        <h2 className="sr-only">{t.shop.departments}</h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {crafts.map((c) => (
            <li key={c.href}>
              <Link
                href={localizeHref(lang, c.href)}
                className="group flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-brand/10 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-brand/30 motion-reduce:transform-none"
              >
                <span className="flex items-center justify-between gap-3 font-display text-xl font-bold">
                  {pick(c.label, lang)}
                  <span aria-hidden="true" className="text-brand transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1">→</span>
                </span>
                <span className="mt-1.5 line-clamp-2 text-sm text-muted">{pick(c.intro, lang)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {themes.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {themes.map((c) => (
              <Link key={c.slug} href={localizeHref(lang, `/categories/${c.slug}`)} className="rounded-full border border-brand/30 bg-white px-4 py-2 text-sm transition-colors hover:bg-brand hover:text-white">
                {c.name} <span className="opacity-60">({c.count})</span>
              </Link>
            ))}
          </div>
        )}
      </PageHeader>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <p className="mb-8 text-muted">{t.catalog.productsCount(products.length)}</p>
        <ProductGrid products={sorted} lang={lang} />
      </div>
    </>
  );
}
