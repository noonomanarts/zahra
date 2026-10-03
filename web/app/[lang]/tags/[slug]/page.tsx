import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { ProductGrid } from "@/components/ProductCard";
import { getTag, listTags, productsWithTag } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

export async function generateStaticParams({ params }: { params: { lang: string } }) {
  if (!isLocale(params.lang)) return [];
  return (await listTags(params.lang)).map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/tags/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const tag = await getTag(slug, lang);
  return tag ? { title: tag.name, alternates: { languages: { en: `/en/tags/${slug}`, ar: `/ar/tags/${slug}` } } } : {};
}

export default async function Page({ params }: PageProps<"/[lang]/tags/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const tag = await getTag(slug, lang);
  if (!tag) notFound();
  const t = getDictionary(lang);
  const items = await productsWithTag(tag.slug, lang);

  return (
    <>
      <PageHeader title={tag.name} lang={lang} crumbs={[{ label: t.nav.shop, href: "/shop" }]} />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <p className="mb-8 text-muted">{t.catalog.productsCount(items.length)}</p>
        <ProductGrid products={items} lang={lang} />
      </div>
    </>
  );
}
