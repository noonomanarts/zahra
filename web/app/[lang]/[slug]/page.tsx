import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Blocks from "@/components/Blocks";
import PageHeader from "@/components/PageHeader";
import { getPage, listPageSlugs } from "@/lib/data";
import { isLocale, pick } from "@/lib/i18n/config";

export async function generateStaticParams() {
  return (await listPageSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const page = await getPage(slug, lang);
  return page
    ? { title: page.title, description: page.description ?? undefined, alternates: { languages: { en: `/en/${slug}`, ar: `/ar/${slug}` } } }
    : {};
}

export default async function StaticPage({ params }: PageProps<"/[lang]/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const page = await getPage(slug, lang);
  if (!page) notFound();

  // the first heading is the page title, shown in the header band
  const [first, ...rest] = page.blocks;
  const blocks = first?.type === "heading" ? rest : page.blocks;
  const title = first?.type === "heading" ? pick(first.text, lang) : page.title;

  return (
    <>
      <PageHeader title={title} lang={lang} />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Blocks blocks={blocks} lang={lang} />
      </div>
    </>
  );
}
