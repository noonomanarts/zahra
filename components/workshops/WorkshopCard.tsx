import Link from "next/link";
import Image from "next/image";
import { Price } from "@/components/ProductCard";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizeHref, type Locale } from "@/lib/i18n/config";
import type { Product } from "@/lib/types";
import BuyWorkshopButton from "./BuyWorkshopButton";

export function WorkshopMeta({ product, lang }: { product: Product; lang: Locale }) {
  const t = getDictionary(lang).workshops;
  if (!product.workshop) return null;
  const items = [
    product.workshop.videos > 0 && { icon: <path d="M10 8.5v7l6-3.5-6-3.5ZM3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />, text: t.videos(product.workshop.videos) },
    product.workshop.files > 0 && { icon: <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6M9 17h4" />, text: t.files(product.workshop.files) },
  ].filter((x): x is { icon: React.ReactElement; text: string } => !!x);
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.text} className="flex items-center gap-1.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{i.icon}</svg>
          {i.text}
        </li>
      ))}
    </ul>
  );
}

export default function WorkshopCard({ product, lang, owned }: { product: Product; lang: Locale; owned: boolean }) {
  const t = getDictionary(lang);
  const href = localizeHref(lang, `/products/${product.slug}`);
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-white transition hover:border-brand/40 hover:shadow-lg">
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-brand-soft" tabIndex={-1} aria-hidden="true">
        {product.images[0] && (
          <Image src={product.images[0]} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        )}
        <span className="absolute start-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-ink shadow-sm">{t.catalog.workshop}</span>
      </Link>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="font-sans text-lg leading-snug font-semibold">
          <Link href={href} className="hover:text-brand-dark focus-visible:underline">{product.name}</Link>
        </h3>
        <div className="mt-2"><WorkshopMeta product={product} lang={lang} /></div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
          <Price product={product} className="text-lg" />
          {owned ? (
            <Link href={localizeHref(lang, `/account/workshops/${product.slug}`)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-dark/40 px-5 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-soft">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12.5 10 17 19 7" /></svg>
              {t.workshops.open}
            </Link>
          ) : product.inStock ? (
            <BuyWorkshopButton slug={product.slug} name={product.nameI18n} price={product.price} currency={product.currency} image={product.images[0] ?? null} />
          ) : (
            <span className="rounded-full bg-zinc-100 px-4 py-2 text-sm text-muted">{t.catalog.soldOut}</span>
          )}
        </div>
      </div>
    </article>
  );
}
