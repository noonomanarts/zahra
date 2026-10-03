import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { ProductGrid } from "@/components/ProductCard";
import { listCategories, listProducts } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref } from "@/lib/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/shop">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).nav.shop, alternates: { languages: { en: "/en/shop", ar: "/ar/shop" } } } : {};
}

export default async function ShopPage({ params }: PageProps<"/[lang]/shop">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const [categories, products] = await Promise.all([listCategories(lang), listProducts(lang)]);
  return (
    <>
      <PageHeader title={t.nav.shop} lang={lang}>
        <div className="mt-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={localizeHref(lang, `/categories/${c.slug}`)}
              className="rounded-full border border-brand/30 bg-white px-4 py-2 text-sm transition-colors hover:bg-brand hover:text-white"
            >
              {c.name} <span className="text-muted">({c.count})</span>
            </Link>
          ))}
        </div>
      </PageHeader>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <p className="mb-8 text-muted">{t.catalog.productsCount(products.length)}</p>
        <ProductGrid products={products} lang={lang} />
      </div>
    </>
  );
}
