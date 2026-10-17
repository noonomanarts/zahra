import type { Block, L, MenuItem } from "./types";

/** Accepts a plain string (content stored before the site was bilingual) or a bilingual value. */
export function toL(value: unknown): L {
  if (value && typeof value === "object" && "en" in value) {
    const v = value as Partial<L>;
    return { en: v.en ?? "", ar: v.ar ?? "" };
  }
  return { en: typeof value === "string" ? value : "", ar: "" };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- normalizes loosely-typed JSON from the database */
export function normalizeBlock(b: any): Block {
  switch (b?.type) {
    case "hero":
      return {
        ...b,
        title: toL(b.title),
        subtitle: toL(b.subtitle),
        html: toL(b.html),
        button: b.button ? { href: b.button.href ?? "/", text: toL(b.button.text) } : null,
      };
    case "heading":
      return { ...b, text: toL(b.text) };
    case "text":
      return { ...b, html: toL(b.html) };
    case "image":
      return { ...b, alt: toL(b.alt) };
    case "accordion":
      return { ...b, items: (b.items ?? []).map((i: any) => ({ question: toL(i.question), answer: toL(i.answer) })) };
    case "counter":
      return { ...b, label: toL(b.label) };
    case "infobox":
      return { ...b, title: toL(b.title), html: toL(b.html) };
    case "button":
      return { ...b, text: toL(b.text) };
    case "testimonials":
      return { ...b, items: (b.items ?? []).map((i: any) => ({ ...i, text: toL(i.text), name: toL(i.name) })) };
    default:
      return b;
  }
}

export function normalizeMenu(items: any[] | undefined): MenuItem[] {
  return (items ?? []).map((m) => ({
    label: toL(m.label),
    href: m.href ?? "/",
    ...(m.children?.length ? { children: normalizeMenu(m.children) } : {}),
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */
