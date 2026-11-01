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

const badge = "rounded-full px-2.5 py-1 text-[11px] leading-none font-medium shadow-sm sm:px-3 sm:text-xs";

export default function ProductCard({ product, lang, isNew }: { product: Product; lang: Locale; isNew?: boolean }) {
  const t = getDictionary(lang);
  const image = product.images[0];
  const soldOut = !product.inStock;
  return (
    <Link href={localizeHref(lang, `/products/${product.slug}`)} className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-dark">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-brand-soft">
        {image && (
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={`object-cover transition-transform duration-500 group-hover:scale-105 ${soldOut ? "opacity-60 grayscale-[35%]" : ""}`}
          />
        )}
        <div className="absolute inset-x-2.5 top-2.5 flex flex-wrap items-start gap-1.5 sm:inset-x-3 sm:top-3">
          {soldOut ? (
            <span className={`${badge} bg-ink/80 text-white`}>{t.catalog.soldOut}</span>
          ) : (
            <>
              {isNew && <span className={`${badge} bg-brand-dark text-white`}>{t.catalog.new}</span>}
              {product.regularPrice && <span className={`${badge} bg-brand text-white`}>{t.catalog.sale}</span>}
            </>
          )}
          {product.kind === "workshop" ? (
            <span className={`${badge} ms-auto bg-white/95 text-ink`}>{t.catalog.workshop}</span>
          ) : (
            product.digital && <span className={`${badge} ms-auto bg-white/95 text-ink`}>{t.catalog.pdf}</span>
          )}
        </div>
      </div>
      <h3 className="mt-3 line-clamp-2 font-sans text-[15px] leading-snug font-normal transition-colors group-hover:text-brand-dark">
        {product.name}
      </h3>
      <Price product={product} className="mt-1 text-sm" />
    </Link>
  );
}

export function ProductGrid({ products, lang, isNew, columns = 4 }: { products: Product[]; lang: Locale; isNew?: boolean; columns?: 3 | 4 }) {
  if (!products.length) return <p className="text-muted">{getDictionary(lang).catalog.noProducts}</p>;
  return (
    <div className={`grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 ${columns === 4 ? "lg:grid-cols-4" : ""}`}>
      {products.map((p) => (
        <ProductCard key={p.slug} product={p} lang={lang} isNew={isNew} />
      ))}
    </div>
  );
}
