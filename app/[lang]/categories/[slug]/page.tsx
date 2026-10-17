import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { ProductGrid } from "@/components/ProductCard";
import { getCategory, listCategories, productsInCategory } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

export async function generateStaticParams({ params }: { params: { lang: string } }) {
  if (!isLocale(params.lang)) return [];
  return (await listCategories(params.lang)).map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/categories/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const category = await getCategory(slug, lang);
  return category ? { title: category.name, alternates: { languages: { en: `/en/categories/${slug}`, ar: `/ar/categories/${slug}` } } } : {};
}

export default async function Page({ params }: PageProps<"/[lang]/categories/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const category = await getCategory(slug, lang);
  if (!category) notFound();
  const t = getDictionary(lang);
  const items = await productsInCategory(category.slug, lang);

  return (
    <>
      <PageHeader title={category.name} lang={lang} crumbs={[{ label: t.nav.shop, href: "/shop" }]} />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <p className="mb-8 text-muted">{t.catalog.productsCount(items.length)}</p>
        <ProductGrid products={items} lang={lang} />
      </div>
    </>
  );
}
