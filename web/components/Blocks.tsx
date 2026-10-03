import Link from "next/link";
import Image from "next/image";
import { getProducts, getSite } from "@/lib/data";
import { isFallback, localizeHref, pick, type Locale } from "@/lib/i18n/config";
import type { Block, L, Product } from "@/lib/types";
import { ProductGrid } from "./ProductCard";
import ContactForm from "./ContactForm";
import Hero from "./Hero";
import Button from "./Button";
import RichText from "./RichText";
import VideoEmbed from "./VideoEmbed";

type Group =
  | Block
  | { type: "tiles"; items: { src: string; alt: L; text: L; href: string }[] }
  | { type: "counters"; items: Extract<Block, { type: "counter" }>[] }
  | { type: "infoboxes"; items: Extract<Block, { type: "infobox" }>[] };

/** Merge runs of related blocks (image+button pairs, counters, info boxes) so they can be laid out together. */
function group(blocks: Block[]): Group[] {
  const out: Group[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    const last = out[out.length - 1];
    if (b.type === "image" && next?.type === "button") {
      const tile = { src: b.src, alt: b.alt, text: next.text, href: next.href };
      if (last?.type === "tiles") last.items.push(tile);
      else out.push({ type: "tiles", items: [tile] });
      i++;
    } else if (b.type === "counter") {
      if (last?.type === "counters") last.items.push(b);
      else out.push({ type: "counters", items: [b] });
    } else if (b.type === "infobox") {
      if (last?.type === "infoboxes") last.items.push(b);
      else out.push({ type: "infoboxes", items: [b] });
    } else out.push(b);
  }
  return out;
}

function youtubeId(url: string) {
  return url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/)?.[1] ?? null;
}

type Ctx = { lang: Locale; products: Map<string, Product>; email: string };

function render(b: Group, key: number, { lang, products, email }: Ctx) {
  const t = (text: L) => pick(text, lang);
  const href = (h: string) => localizeHref(lang, h);
  switch (b.type) {
    case "hero":
      return <Hero key={key} hero={b} lang={lang} />;
    case "heading": {
      const Tag = `h${Math.min(Math.max(b.level, 1), 4)}` as "h1" | "h2" | "h3" | "h4";
      const size = b.level <= 1 ? "text-4xl sm:text-5xl" : b.level === 2 ? "text-3xl sm:text-4xl" : "text-2xl";
      return <Tag key={key} className={`mt-14 font-bold first:mt-0 ${size}`}>{t(b.text)}</Tag>;
    }
    case "text":
      return <RichText key={key} text={b.html} lang={lang} className="mt-4 max-w-3xl" />;
    case "image":
      return (
        <Image
          key={key}
          src={b.src}
          alt={t(b.alt)}
          width={0}
          height={0}
          sizes="(min-width: 1280px) 1200px, 100vw"
          className="mx-auto mt-8 h-auto w-auto max-w-full rounded-3xl"
        />
      );
    case "gallery":
      return (
        <div key={key} className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {b.images.map((src) => (
            <div key={src} className="relative aspect-square overflow-hidden rounded-2xl bg-brand-soft">
              <Image src={src} alt="" fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" />
            </div>
          ))}
        </div>
      );
    case "tiles":
      return (
        <div key={key} className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {b.items.map((tile) => (
            <Link key={tile.href + tile.src} href={href(tile.href)} className="group relative aspect-[4/5] overflow-hidden rounded-3xl bg-brand-soft">
              <Image src={tile.src} alt={t(tile.alt) || t(tile.text)} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute inset-x-3 bottom-3 rounded-full bg-white/95 px-4 py-2.5 text-center text-sm shadow-sm transition-colors group-hover:bg-brand group-hover:text-white">
                {t(tile.text)}
              </span>
            </Link>
          ))}
        </div>
      );
    case "accordion":
      return (
        <div key={key} className="mt-8 divide-y divide-line rounded-3xl border border-line">
          {b.items.map((item, i) => (
            <details key={i} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                <span dir={isFallback(item.question, lang) ? "ltr" : undefined}>{t(item.question)}</span>
                <span className="text-xl text-brand transition-transform group-open:rotate-45">+</span>
              </summary>
              <RichText text={item.answer} lang={lang} className="mt-3 text-muted" />
            </details>
          ))}
        </div>
      );
    case "counters":
      return (
        <div key={key} className="mt-10 grid gap-4 sm:grid-cols-3">
          {b.items.map((c, i) => (
            <div key={i} className="rounded-3xl bg-brand-soft p-8 text-center">
              <p className="font-display text-4xl font-bold text-brand-dark" dir="ltr">{c.value}{c.suffix}</p>
              <p className="mt-2 text-muted">{t(c.label)}</p>
            </div>
          ))}
        </div>
      );
    case "infoboxes":
      return (
        <div key={key} className="mt-8 grid gap-4 sm:grid-cols-2">
          {b.items.map((c, i) => (
            <div key={i} className="rounded-3xl border border-line p-6">
              {t(c.title) && <h3 className="text-xl font-bold">{t(c.title)}</h3>}
              <RichText text={c.html} lang={lang} className="mt-2 text-muted" />
            </div>
          ))}
        </div>
      );
    case "video": {
      const id = youtubeId(b.url);
      return id ? <VideoEmbed key={key} id={id} /> : <video key={key} src={b.url} controls className="mt-8 w-full rounded-3xl" />;
    }
    case "button":
      return <div key={key} className="mt-6"><Button href={href(b.href)}>{t(b.text)}</Button></div>;
    case "products":
      return (
        <div key={key} className="mt-8">
          <ProductGrid lang={lang} products={b.products.map((s) => products.get(s)).filter((p): p is Product => !!p)} />
        </div>
      );
    case "testimonials":
      return (
        <div key={key} className="mt-8 grid gap-4 md:grid-cols-3">
          {b.items.map((item, i) => (
            <figure key={i} className="flex flex-col rounded-3xl bg-brand-soft p-7">
              <span className="font-display text-5xl leading-none text-brand">“</span>
              <blockquote className="mt-2 flex-1 leading-relaxed" dir={isFallback(item.text, lang) ? "ltr" : undefined}>{t(item.text)}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3 font-semibold">
                {item.image && <Image src={item.image} alt="" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />}
                {t(item.name)}
              </figcaption>
            </figure>
          ))}
        </div>
      );
    case "contact-form":
      return <div key={key} className="mt-8"><ContactForm email={email} /></div>;
  }
}

export default async function Blocks({ blocks, lang }: { blocks: Block[]; lang: Locale }) {
  const slugs = blocks.flatMap((b) => (b.type === "products" ? b.products : []));
  const [products, site] = await Promise.all([getProducts(slugs, lang), getSite()]);
  const ctx = { lang, products: new Map(products.map((p) => [p.slug, p])), email: site.contact.emails[0] ?? "" };
  return <>{group(blocks).map((b, i) => render(b, i, ctx))}</>;
}
