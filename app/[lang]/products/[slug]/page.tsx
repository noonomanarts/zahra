import { renderRichContent } from "@/lib/rich-content";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ProductGallery from "@/components/ProductGallery";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { Price, ProductGrid } from "@/components/ProductCard";
import { WorkshopMeta } from "@/components/workshops/WorkshopCard";
import { DEPARTMENTS, WORKSHOPS_PATH, sectionHref } from "@/lib/catalog";
import { getCustomer } from "@/lib/customer-auth";
import { getCategory, getProduct, getProducts, getTag, listProducts } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref, pick, type Locale } from "@/lib/i18n/config";
import type { Product } from "@/lib/types";
import { ownsWorkshop } from "@/lib/workshops";

/** Breadcrumb: department and section when the product is in one, otherwise the shop and its category. */
async function crumbsFor(product: Product, lang: Locale) {
  const t = getDictionary(lang);
  if (product.kind === "workshop") return [{ label: t.workshops.title, href: WORKSHOPS_PATH }];
  for (const d of DEPARTMENTS) {
    const s = d.sections.find((x) => "category" in x && product.categories.includes(x.category));
    if (s) return [{ label: pick(d.label, lang), href: `/${d.slug}` }, { label: pick(s.label, lang), href: sectionHref(d, s) }];
  }
  const category = await getCategory(product.categories[0] ?? "", lang);
  return [{ label: t.nav.shop, href: "/shop" }, ...(category ? [{ label: category.name, href: `/categories/${category.slug}` }] : [])];
}

export async function generateStaticParams({ params }: { params: { lang: string } }) {
  if (!isLocale(params.lang)) return [];
  return (await listProducts(params.lang)).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/products/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const product = await getProduct(slug, lang);
  return product
    ? {
        title: product.name,
        openGraph: { images: product.images.slice(0, 1) },
        alternates: { languages: { en: `/en/products/${slug}`, ar: `/ar/products/${slug}` } },
      }
    : {};
}

export default async function ProductPage({ params }: PageProps<"/[lang]/products/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const product = await getProduct(slug, lang);
  if (!product) notFound();
  const t = getDictionary(lang);

  const [category, tags, related, crumbs, customer] = await Promise.all([
    getCategory(product.categories[0] ?? "", lang),
    Promise.all(product.tags.map((s) => getTag(s, lang))).then((x) => x.filter((v) => !!v)),
    getProducts(product.related, lang).then((r) => r.slice(0, 4)),
    crumbsFor(product, lang),
    getCustomer(),
  ]);
  const isWorkshop = product.kind === "workshop";
  const owned = isWorkshop && !!customer && (await ownsWorkshop(customer.id, product.id));
  // Arabic description missing → the English one is shown left-to-right
  const descriptionIsEnglish = lang === "ar" && /^[^؀-ۿ]*$/.test(product.description.replace(/<[^>]+>/g, ""));

  return (
    <>
      <PageHeader title={product.name} lang={lang} crumbs={crumbs} />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2">
        <ProductGallery images={product.images} alt={product.name} />

        <div>
          <Price product={product} className="text-2xl" />
          {isWorkshop ? (
            <div className="mt-6 rounded-2xl bg-brand-soft/60 p-5">
              <p className="text-sm font-semibold">{t.workshops.includes}</p>
              <div className="mt-2"><WorkshopMeta product={product} lang={lang} /></div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3a4 4 0 0 0-4 4v3H6v11h12V10h-2V7a4 4 0 0 0-4-4Zm-2 7V7a2 2 0 1 1 4 0v3" /></svg>
                {t.workshops.access}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              {product.digital ? t.product.digitalNote : product.inStock ? t.product.inStock : t.product.outOfStock}
            </p>
          )}

          {owned ? (
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={localizeHref(lang, `/account/workshops/${product.slug}`)} className="inline-flex min-h-14 items-center gap-2 rounded-full bg-brand-dark px-10 text-white transition-colors hover:bg-ink">
                {t.workshops.open} <span aria-hidden="true" className="rtl:rotate-180">→</span>
              </Link>
              <p className="text-sm text-muted">{t.workshops.owned}</p>
            </div>
          ) : (
            <>
              <AddToCartButton
                disabled={!product.inStock}
                buyNow={isWorkshop ? t.workshops.buy : undefined}
                item={{
                  slug: product.slug,
                  name: product.nameI18n,
                  price: product.price,
                  currency: product.currency,
                  image: product.images[0] ?? null,
                  digital: product.digital || isWorkshop,
                  workshop: isWorkshop || undefined,
                }}
              />
              {isWorkshop && !customer && <p className="mt-3 max-w-md text-xs leading-relaxed text-muted">{t.workshops.loginToBuy}</p>}
            </>
          )}

          <dl className="mt-10 space-y-2 border-t border-line pt-6 text-sm">
            {product.sku && (
              <div className="flex gap-2"><dt className="text-muted">{t.product.sku}:</dt><dd dir="ltr">{product.sku}</dd></div>
            )}
            {category && !isWorkshop && (
              <div className="flex gap-2">
                <dt className="text-muted">{t.product.category}:</dt>
                <dd><Link href={localizeHref(lang, `/categories/${category.slug}`)} className="hover:text-brand-dark">{category.name}</Link></dd>
              </div>
            )}
          </dl>
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link key={tag.slug} href={localizeHref(lang, `/tags/${tag.slug}`)} className="rounded-full bg-brand-soft px-3 py-1 text-xs hover:bg-brand hover:text-white">
                  {tag.name}
                </Link>
              ))}
            </div>
          )}

          {product.description && (
            <section className="mt-10">
              <h2 className="text-2xl font-bold">{t.product.description}</h2>
              <div
                className="prose-zahra markdown-content mt-3"
                dir={descriptionIsEnglish ? "ltr" : undefined}
                dangerouslySetInnerHTML={{ __html: renderRichContent(product.description, lang) }}
              />
            </section>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="mb-8 text-3xl font-bold">{t.product.related}</h2>
          <ProductGrid products={related} lang={lang} />
        </section>
      )}
    </>
  );
}
