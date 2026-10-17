import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ProductGallery from "@/components/ProductGallery";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { Price, ProductGrid } from "@/components/ProductCard";
import { getCategory, getProduct, getProducts, getTag, listProducts } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref, localizeHtml } from "@/lib/i18n/config";

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

  const [category, tags, related] = await Promise.all([
    getCategory(product.categories[0] ?? "", lang),
    Promise.all(product.tags.map((s) => getTag(s, lang))).then((x) => x.filter((v) => !!v)),
    getProducts(product.related, lang).then((r) => r.slice(0, 4)),
  ]);
  // Arabic description missing → the English one is shown left-to-right
  const descriptionIsEnglish = lang === "ar" && /^[^؀-ۿ]*$/.test(product.description.replace(/<[^>]+>/g, ""));

  return (
    <>
      <PageHeader
        title={product.name}
        lang={lang}
        crumbs={[
          { label: t.nav.shop, href: "/shop" },
          ...(category ? [{ label: category.name, href: `/categories/${category.slug}` }] : []),
        ]}
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2">
        <ProductGallery images={product.images} alt={product.name} />

        <div>
          <Price product={product} className="text-2xl" />
          <p className="mt-3 text-sm text-muted">
            {product.digital ? t.product.digitalNote : product.inStock ? t.product.inStock : t.product.outOfStock}
          </p>

          <AddToCartButton
            disabled={!product.inStock}
            item={{
              slug: product.slug,
              name: product.nameI18n,
              price: product.price,
              currency: product.currency,
              image: product.images[0] ?? null,
              digital: product.digital,
            }}
          />

          <dl className="mt-10 space-y-2 border-t border-line pt-6 text-sm">
            {product.sku && (
              <div className="flex gap-2"><dt className="text-muted">{t.product.sku}:</dt><dd dir="ltr">{product.sku}</dd></div>
            )}
            {category && (
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
                className="prose-zahra mt-3"
                dir={descriptionIsEnglish ? "ltr" : undefined}
                dangerouslySetInnerHTML={{ __html: localizeHtml(product.description, lang) }}
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
