import Link from "next/link";
import Image from "next/image";
import { getProducts, getSite, newArrivals } from "@/lib/data";
import { fixWhatsappLinks, whatsappDigits } from "@/lib/whatsapp";
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

type Ctx = { lang: Locale; products: Map<string, Product>; fresh: Product[]; email: string; whatsapp: string };

function render(b: Group, key: number, { lang, products, fresh, email, whatsapp }: Ctx) {
  const t = (text: L) => pick(text, lang);
  const href = (h: string) => localizeHref(lang, fixWhatsappLinks(h, whatsapp));
  // content imported from the old site may still contain WhatsApp short links that no longer work
  const html = (text: L): L => ({ en: fixWhatsappLinks(text.en, whatsapp), ar: fixWhatsappLinks(text.ar, whatsapp) });
  switch (b.type) {
    case "hero":
      return <Hero key={key} hero={b} lang={lang} />;
    case "heading": {
      const Tag = `h${Math.min(Math.max(b.level, 1), 4)}` as "h1" | "h2" | "h3" | "h4";
      const size = b.level <= 1 ? "text-4xl sm:text-5xl" : b.level === 2 ? "text-3xl sm:text-4xl" : "text-2xl";
      return <Tag key={key} className={`mt-14 font-bold first:mt-0 ${size}`}>{t(b.text)}</Tag>;
    }
    case "text":
      return <RichText key={key} text={html(b.html)} lang={lang} className="mt-4 max-w-3xl" />;
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
    case "tiles": {
      // Transparent compositions without a card. From sm up the row runs from browser edge to browser edge:
      // the straight edges of the outer artworks meet the window edges, also in Arabic (kept in visual order).
      const cols = b.items.length % 3 === 0 ? "sm:grid-cols-3" : b.items.length % 4 === 0 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2";
      return (
        <div key={key} dir="ltr" className={`mt-6 grid gap-x-4 gap-y-12 sm:mx-[calc(50%-50vw)] lg:gap-x-8 ${cols}`}>
          {b.items.map((tile) => (
            <Link
              key={tile.href + tile.src}
              href={href(tile.href)}
              dir={lang === "ar" ? "rtl" : "ltr"}
              className="group flex flex-col items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-dark"
            >
              <span className="relative block aspect-[14/15] w-full">
                <Image
                  src={tile.src}
                  alt={t(tile.alt) || t(tile.text)}
                  fill
                  sizes="(min-width: 640px) 34vw, 100vw"
                  className="object-contain transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transform-none"
                />
              </span>
              <span className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-brand-dark/25 bg-white px-8 text-sm font-medium text-ink shadow-sm transition-colors duration-300 group-hover:border-brand-dark group-hover:bg-brand-dark group-hover:text-white">
                {t(tile.text)}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1">→</span>
              </span>
            </Link>
          ))}
        </div>
      );
    }
    case "accordion":
      return (
        <div key={key} className="mt-8 divide-y divide-line rounded-3xl border border-line">
          {b.items.map((item, i) => (
            <details key={i} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                <span dir={isFallback(item.question, lang) ? "ltr" : undefined}>{t(item.question)}</span>
                <span className="text-xl text-brand transition-transform group-open:rotate-45">+</span>
              </summary>
              <RichText text={html(item.answer)} lang={lang} className="mt-3 text-muted" />
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
              <RichText text={html(c.html)} lang={lang} className="mt-2 text-muted" />
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
    case "new-arrivals":
      return (
        <div key={key} className="mt-8">
          <ProductGrid lang={lang} products={fresh.slice(0, b.limit)} isNew columns={b.limit % 3 === 0 && b.limit % 4 !== 0 ? 3 : 4} />
        </div>
      );
    case "testimonials":
      return (
        <div key={key} className="mt-8 grid gap-4 md:grid-cols-3">
          {b.items.map((item, i) => (
            <figure key={i} className="flex flex-col rounded-3xl bg-brand-soft p-7">
              <span className="font-display text-5xl leading-none text-brand">“</span>
              <blockquote className="mt-2 flex-1 leading-relaxed" dir={isFallback(item.text, lang) ? "ltr" : undefined}><RichText text={item.text} lang={lang} /></blockquote>
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
  const limit = Math.max(0, ...blocks.map((b) => (b.type === "new-arrivals" ? b.limit : 0)));
  const [products, fresh, site] = await Promise.all([getProducts(slugs, lang), limit ? newArrivals(lang, limit) : [], getSite()]);
  const ctx = {
    lang,
    products: new Map(products.map((p) => [p.slug, p])),
    fresh,
    email: site.contact.emails[0] ?? "",
    whatsapp: whatsappDigits(site),
  };
  return <>{group(blocks).map((b, i) => render(b, i, ctx))}</>;
}
