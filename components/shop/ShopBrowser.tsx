"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { useI18n } from "@/components/providers/I18nProvider";
import type { Locale } from "@/lib/i18n/config";
import type { Product } from "@/lib/types";

/** Removes what people type differently: case, accents, Arabic vowel marks and letter forms. */
const fold = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();

const SORTS = ["featured", "newest", "priceLow", "priceHigh", "name"] as const;
type Sort = (typeof SORTS)[number];
const TYPES = ["all", "digital", "physical"] as const;
type Kind = (typeof TYPES)[number];

const control = "rounded-full border border-line bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";

/** Instant search, filters and sorting; runs in the browser, so the page stays static and works offline. */
export default function ShopBrowser({ products, lang }: { products: Product[]; lang: Locale }) {
  const { t } = useI18n();
  const s = t.shop;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("featured");
  const [kind, setKind] = useState<Kind>("all");
  const [inStock, setInStock] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // the search icon in the header links to #shop-search, and shared links can carry ?q=
    const shared = new URLSearchParams(window.location.search).get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only known in the browser
    if (shared) setQuery(shared.slice(0, 100));
    if (window.location.hash === "#shop-search") input.current?.focus();
  }, []);

  const index = useMemo(() => products.map((p) => ({ product: p, text: fold([p.nameI18n.en, p.nameI18n.ar, p.sku ?? "", ...p.categories, ...p.tags].join(" ").replace(/-/g, " ")) })), [products]);
  const results = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    const found = index
      .filter(({ product: p, text }) => words.every((w) => text.includes(w)) && (!inStock || p.inStock) && (kind === "all" || p.digital === (kind === "digital")))
      .map((x) => x.product);
    const compare: Record<Sort, (a: Product, b: Product) => number> = {
      featured: (a, b) => Number(b.inStock) - Number(a.inStock),
      newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id,
      priceLow: (a, b) => a.price - b.price,
      priceHigh: (a, b) => b.price - a.price,
      name: (a, b) => a.name.localeCompare(b.name, lang),
    };
    return found.sort(compare[sort]);
  }, [index, query, kind, inStock, sort, lang]);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-3 scroll-mt-40" id="shop-search">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <svg className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <input ref={input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label={s.search} placeholder={s.searchPlaceholder} className={`${control} w-full ps-11`} />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} aria-label={s.typeLabel} className={control}>
          {TYPES.map((k) => <option key={k} value={k}>{s.types[k]}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={s.sortLabel} className={control}>
          {SORTS.map((k) => <option key={k} value={k}>{s.sort[k]}</option>)}
        </select>
        <label className="flex cursor-pointer items-center gap-2 px-1 text-sm">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="size-4 accent-brand-dark" />
          {s.inStockOnly}
        </label>
        <p role="status" className="ms-auto text-sm text-muted">{t.catalog.productsCount(results.length)}</p>
      </div>

      {results.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((p) => <ProductCard key={p.slug} product={p} lang={lang} />)}
        </div>
      ) : (
        <div className="rounded-3xl border border-line px-6 py-14 text-center">
          <p className="text-muted">{s.noResults}</p>
          <button type="button" onClick={() => { setQuery(""); setKind("all"); setInStock(false); }} className="mt-4 rounded-full border border-brand-dark/25 px-5 py-2 text-sm transition hover:bg-brand-soft">{s.clearSearch}</button>
        </div>
      )}
    </>
  );
}
