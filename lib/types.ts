/** A bilingual text. `ar` may be empty: the English text is then shown on the Arabic site. */
export type L = { en: string; ar: string };

export type Block =
  | {
      type: "hero";
      title: L;
      subtitle: L;
      html: L;
      button: { text: L; href: string } | null;
      image: string | null; // collage shown on small screens
      background: string | null; // full composition shown behind the text on large screens
    }
  | { type: "heading"; level: number; text: L }
  | { type: "text"; html: L }
  | { type: "image"; src: string; alt: L }
  | { type: "gallery"; images: string[] }
  | { type: "accordion"; items: { question: L; answer: L }[] }
  | { type: "counter"; value: string; suffix: string; label: L }
  | { type: "video"; url: string }
  | { type: "infobox"; title: L; html: L }
  | { type: "button"; text: L; href: string }
  | { type: "products"; products: string[] }
  | { type: "testimonials"; items: { text: L; name: L; image: string | null }[] }
  | { type: "contact-form" };

export type MenuItem = { label: L; href: string; children?: MenuItem[] };

/** A product as shown on the storefront, already localized. */
export type Product = {
  id: number;
  slug: string;
  name: string;
  nameI18n: L;
  sku: string | null;
  currency: string;
  price: number;
  regularPrice: number | null;
  inStock: boolean;
  digital: boolean;
  published: boolean;
  images: string[];
  description: string;
  related: string[];
  categories: string[];
  tags: string[];
};

export type Term = { id: number; slug: string; name: string; nameI18n: L; count: number };

export type Page = { slug: string; title: string; description: string | null; blocks: Block[] };
