import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { ProductGrid } from "@/components/ProductCard";
import { EmptyCollection, SectionTabs } from "@/components/shop/Collections";
import CustomPatternPage from "@/components/services/CustomPatternPage";
import PrintDesignPage from "@/components/services/PrintDesignPage";
import { DEPARTMENTS, getDepartment, getSection } from "@/lib/catalog";
import { getSite, productsInCategory } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref, pick } from "@/lib/i18n/config";
import { whatsappDigits } from "@/lib/whatsapp";

export function generateStaticParams() {
  return DEPARTMENTS.flatMap((d) => d.sections.filter((s) => !("href" in s)).map((s) => ({ slug: d.slug, section: s.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[slug]/[section]">): Promise<Metadata> {
  const { lang, slug, section } = await params;
  const s = getSection(slug, section);
  if (!s || !isLocale(lang)) return {};
  return {
    title: `${pick(s.label, lang)} – ${pick(getDepartment(slug)!.label, lang)}`,
    description: pick(s.intro, lang),
    alternates: { languages: { en: `/en/${slug}/${section}`, ar: `/ar/${slug}/${section}` } },
  };
}

export default async function SectionPage({ params }: PageProps<"/[lang]/[slug]/[section]">) {
  const { lang, slug, section: sectionSlug } = await params;
  if (!isLocale(lang)) notFound();
  const department = getDepartment(slug);
  const section = getSection(slug, sectionSlug);
  if (!department || !section) notFound();
  if ("href" in section) permanentRedirect(localizeHref(lang, section.href));

  const crumbs = [{ label: pick(department.label, lang), href: `/${department.slug}` }];
  if ("service" in section) {
    return section.service === "custom-pattern" ? <CustomPatternPage lang={lang} crumbs={crumbs} /> : <PrintDesignPage lang={lang} crumbs={crumbs} />;
  }

  const [products, site] = await Promise.all([productsInCategory(section.category, lang), getSite()]);
  const t = getDictionary(lang);
  const title = pick(section.label, lang);

  return (
    <>
      <PageHeader title={title} lang={lang} crumbs={crumbs} eyebrow={pick(department.label, lang)} intro={pick(section.intro, lang)}>
        <SectionTabs department={department} current={section.slug} lang={lang} />
      </PageHeader>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {products.length ? (
          <>
            <p className="mb-8 text-muted">{t.catalog.productsCount(products.length)}</p>
            <ProductGrid products={products} lang={lang} />
          </>
        ) : (
          <EmptyCollection lang={lang} whatsapp={whatsappDigits(site)} title={`${pick(department.label, lang)} – ${title}`} />
        )}
      </div>
    </>
  );
}
