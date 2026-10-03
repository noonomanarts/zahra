import Link from "next/link";
import Image from "next/image";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizeHref, type Locale } from "@/lib/i18n/config";
import type { Product } from "@/lib/types";
import Money from "./Money";

export function Price({ product, className = "" }: { product: Product; className?: string }) {
  return (
    <p className={`flex flex-wrap items-baseline gap-x-2 ${className}`}>
      {product.regularPrice && <Money amount={product.regularPrice} className="text-sm text-muted line-through" />}
      <Money amount={product.price} className="font-semibold text-brand-dark" />
    </p>
  );
}

export default function ProductCard({ product, lang }: { product: Product; lang: Locale }) {
  const t = getDictionary(lang);
  const image = product.images[0];
  return (
    <Link href={localizeHref(lang, `/products/${product.slug}`)} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-brand-soft">
        {image && (
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {product.regularPrice && (
          <span className="absolute start-3 top-3 rounded-full bg-brand px-3 py-1 text-xs text-white">{t.catalog.sale}</span>
        )}
        {product.digital && <span className="absolute end-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs text-ink">{t.catalog.pdf}</span>}
      </div>
      <h3 className="mt-3 line-clamp-2 font-sans text-[15px] leading-snug font-normal transition-colors group-hover:text-brand-dark">
        {product.name}
      </h3>
      <Price product={product} className="mt-1 text-sm" />
    </Link>
  );
}

export function ProductGrid({ products, lang }: { products: Product[]; lang: Locale }) {
  if (!products.length) return <p className="text-muted">{getDictionary(lang).catalog.noProducts}</p>;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.slug} product={p} lang={lang} />
      ))}
    </div>
  );
}
