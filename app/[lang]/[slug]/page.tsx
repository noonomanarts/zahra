import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Blocks from "@/components/Blocks";
import PageHeader from "@/components/PageHeader";
import { ProductGrid } from "@/components/ProductCard";
import { SectionCard, SectionTabs } from "@/components/shop/Collections";
import { DEPARTMENTS, EMBEDDED_PAGES, getDepartment, type Department, type Section } from "@/lib/catalog";
import { getPage, getPageRaw, listPageSlugs, productsInCategory } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref, pick, type Locale } from "@/lib/i18n/config";
import type { Product } from "@/lib/types";

export async function generateStaticParams() {
  return [...DEPARTMENTS.map((d) => ({ slug: d.slug })), ...(await listPageSlugs()).map((slug) => ({ slug }))];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const alternates = { languages: { en: `/en/${slug}`, ar: `/ar/${slug}` } };
  const department = getDepartment(slug);
  if (department) return { title: pick(department.label, lang), description: pick(department.intro, lang), alternates };
  const page = await getPage(slug, lang);
  return page ? { title: page.title, description: page.description ?? undefined, alternates } : {};
}

/** Cover photo of a section card: an available product, any product, or the first image of its page. */
async function coverImage(section: Section, products: Product[] | null) {
  const fromProducts = products?.find((p) => p.inStock && p.images[0])?.images[0] ?? products?.find((p) => p.images[0])?.images[0];
  if (fromProducts) return fromProducts;
  const pageSlug = "href" in section ? section.href.slice(1) : "service" in section && section.service === "custom-pattern" ? "customized-pattern" : null;
  const page = pageSlug ? await getPageRaw(pageSlug) : null;
  for (const b of page?.blocks ?? []) {
    if (b.type === "gallery" && b.images[0]) return b.images[0];
    if (b.type === "image" && b.src) return b.src;
  }
  return null;
}

/** A department (Cross Stitch, Hand Embroidery, Crochet): its sections, then all of its products. */
async function DepartmentPage({ department, lang }: { department: Department; lang: Locale }) {
  const t = getDictionary(lang);
  const lists = await Promise.all(
    department.sections.map((s) => ("category" in s ? productsInCategory(s.category, lang) : Promise.resolve(null))),
  );
  const products = [...new Map(lists.flatMap((l) => l ?? []).map((p): [string, Product] => [p.slug, p])).values()].sort(
    (a, b) => Number(b.inStock) - Number(a.inStock),
  );
  const name = pick(department.label, lang);
  const covers = await Promise.all(department.sections.map((s, i) => coverImage(s, lists[i])));

  return (
    <>
      <PageHeader title={name} lang={lang} intro={pick(department.intro, lang)}>
        <SectionTabs department={department} lang={lang} />
      </PageHeader>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h2 className="sr-only">{t.shop.sectionsTitle}</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {department.sections.map((s, i) => (
            <SectionCard
              key={s.slug}
              department={department}
              section={s}
              lang={lang}
              count={lists[i]?.length ?? null}
              image={covers[i]}
            />
          ))}
        </div>

        {products.length > 0 && (
          <section className="mt-20">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-3xl font-bold">{t.shop.browseAll(name)}</h2>
              <p className="text-muted">{t.catalog.productsCount(products.length)}</p>
            </div>
            <ProductGrid products={products} lang={lang} />
          </section>
        )}
      </div>
    </>
  );
}

export default async function StaticPage({ params }: PageProps<"/[lang]/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const department = getDepartment(slug);
  if (department) return <DepartmentPage department={department} lang={lang} />;
  if (EMBEDDED_PAGES[slug]) permanentRedirect(localizeHref(lang, EMBEDDED_PAGES[slug]));

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
