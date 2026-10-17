"use client";

/* eslint-disable @next/next/no-img-element -- admin previews */
import { useActionState, useEffect, useState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Card, Field, FormMessage, LField, LangTag, btnCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import type { Block, L } from "@/lib/types";
import { savePage, type PageFormState } from "./actions";

const E: L = { en: "", ar: "" };
const NEW_BLOCKS: Record<string, Block> = {
  heading: { type: "heading", level: 2, text: E },
  text: { type: "text", html: { en: "<p></p>", ar: "<p></p>" } },
  image: { type: "image", src: "", alt: E },
  button: { type: "button", text: E, href: "/" },
  accordion: { type: "accordion", items: [{ question: E, answer: E }] },
  video: { type: "video", url: "" },
  products: { type: "products", products: [] },
};

const area = `${inputCls} pe-10 font-mono text-xs`;

/** Controlled pair of inputs for a bilingual value. */
function LInput({ label, value, onChange, multiline, rows = 3, mono }: { label?: string; value: L; onChange: (v: L) => void; multiline?: boolean; rows?: number; mono?: boolean }) {
  const one = (lang: "en" | "ar") => {
    const props = {
      value: value[lang],
      dir: lang === "ar" ? "rtl" : "ltr",
      lang,
      "aria-label": label ? `${label} (${lang})` : lang,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [lang]: e.target.value }),
      className: mono || multiline ? area : `${inputCls} pe-10`,
    } as const;
    return (
      <div className="relative">
        {multiline ? <textarea rows={rows} {...props} /> : <input {...props} />}
        <LangTag lang={lang} />
      </div>
    );
  };
  return (
    <div>
      {label && <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>}
      <div className={`grid gap-2 ${multiline ? "lg:grid-cols-2" : "sm:grid-cols-2"}`}>
        {one("en")}
        {one("ar")}
      </div>
    </div>
  );
}

/** Form fields for one block; `set` replaces the block. */
function BlockFields({ block, index, set }: { block: Block; index: number; set: (b: Block) => void }) {
  const { t } = useAdminI18n();
  const f = t.pages.f;
  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-4">
          <LInput label={f.title} value={block.title} onChange={(title) => set({ ...block, title })} />
          <LInput label={f.subtitle} value={block.subtitle} onChange={(subtitle) => set({ ...block, subtitle })} />
          <LInput label={f.text} value={block.html} multiline onChange={(html) => set({ ...block, html })} />
          <LInput
            label={f.buttonLabel}
            value={block.button?.text ?? E}
            onChange={(text) => set({ ...block, button: text.en || text.ar ? { href: block.button?.href ?? "/shop", text } : null })}
          />
          <Field label={f.buttonLink}>
            <input
              value={block.button?.href ?? ""}
              disabled={!block.button}
              dir="ltr"
              onChange={(e) => block.button && set({ ...block, button: { ...block.button, href: e.target.value } })}
              className={inputCls}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={f.background} hint={f.backgroundHint}>
              <div className="flex items-center gap-3">
                {block.background && <img src={block.background} alt="" className="h-16 w-auto rounded" />}
                <input name={`upload-bg-${index}`} type="file" accept="image/*" className="text-sm" />
              </div>
            </Field>
            <Field label={f.mobileImage}>
              <div className="flex items-center gap-3">
                {block.image && <img src={block.image} alt="" className="h-16 w-auto rounded" />}
                <input name={`upload-${index}`} type="file" accept="image/*" className="text-sm" />
              </div>
            </Field>
          </div>
        </div>
      );
    case "heading":
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_100px] sm:items-end">
          <LInput label={f.heading} value={block.text} onChange={(text) => set({ ...block, text })} />
          <Field label={f.level}>
            <select value={block.level} onChange={(e) => set({ ...block, level: Number(e.target.value) })} className={inputCls}>
              {[1, 2, 3, 4].map((l) => <option key={l} value={l}>H{l}</option>)}
            </select>
          </Field>
        </div>
      );
    case "text":
      return <LInput value={block.html} multiline rows={8} onChange={(html) => set({ ...block, html })} />;
    case "image":
      return (
        <div className="flex flex-wrap items-start gap-4">
          {block.src && <img src={block.src} alt="" className="h-24 w-24 rounded-lg object-cover" />}
          <div className="min-w-64 flex-1 space-y-3">
            <LInput label={f.alt} value={block.alt} onChange={(alt) => set({ ...block, alt })} />
            <Field label={f.newImage}><input name={`upload-${index}`} type="file" accept="image/*" className="block text-sm" /></Field>
          </div>
        </div>
      );
    case "gallery":
      return (
        <Field label={f.imageUrls}>
          <textarea rows={4} dir="ltr" value={block.images.join("\n")} onChange={(e) => set({ ...block, images: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} className={area} />
        </Field>
      );
    case "accordion":
      return (
        <div className="space-y-3">
          {block.items.map((item, i) => {
            const update = (patch: Partial<typeof item>) => set({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="space-y-3 rounded-lg border border-zinc-200 p-3">
                <LInput label={f.question} value={item.question} onChange={(question) => update({ question })} />
                <LInput label={f.answer} value={item.answer} multiline onChange={(answer) => update({ answer })} />
                <button type="button" onClick={() => set({ ...block, items: block.items.filter((_, j) => j !== i) })} className="text-xs text-red-700">
                  {f.removeQuestion}
                </button>
              </div>
            );
          })}
          <button type="button" onClick={() => set({ ...block, items: [...block.items, { question: E, answer: E }] })} className={btnSecondaryCls}>
            {f.addQuestion}
          </button>
        </div>
      );
    case "counter":
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={f.value}><input dir="ltr" value={block.value} onChange={(e) => set({ ...block, value: e.target.value })} className={inputCls} /></Field>
            <Field label={f.suffix}><input dir="ltr" value={block.suffix} onChange={(e) => set({ ...block, suffix: e.target.value })} className={inputCls} /></Field>
          </div>
          <LInput label={f.label} value={block.label} onChange={(label) => set({ ...block, label })} />
        </div>
      );
    case "video":
      return <Field label={f.videoUrl}><input dir="ltr" value={block.url} onChange={(e) => set({ ...block, url: e.target.value })} className={inputCls} /></Field>;
    case "infobox":
      return (
        <div className="space-y-3">
          <LInput label={f.title} value={block.title} onChange={(title) => set({ ...block, title })} />
          <LInput label={f.text} value={block.html} multiline onChange={(html) => set({ ...block, html })} />
        </div>
      );
    case "button":
      return (
        <div className="space-y-3">
          <LInput label={f.buttonLabel} value={block.text} onChange={(text) => set({ ...block, text })} />
          <Field label={f.link}><input dir="ltr" value={block.href} onChange={(e) => set({ ...block, href: e.target.value })} className={inputCls} /></Field>
        </div>
      );
    case "products":
      return (
        <Field label={f.productSlugs}>
          <textarea rows={2} dir="ltr" value={block.products.join(", ")} onChange={(e) => set({ ...block, products: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={area} />
        </Field>
      );
    case "testimonials":
      return (
        <div className="space-y-3">
          {block.items.map((item, i) => {
            const update = (patch: Partial<typeof item>) => set({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="space-y-3 rounded-lg border border-zinc-200 p-3">
                <LInput label={f.quote} value={item.text} multiline rows={2} onChange={(text) => update({ text })} />
                <LInput label={f.name} value={item.name} onChange={(name) => update({ name })} />
              </div>
            );
          })}
          <button type="button" onClick={() => set({ ...block, items: [...block.items, { text: E, name: E, image: null }] })} className={btnSecondaryCls}>
            {f.addTestimonial}
          </button>
        </div>
      );
    case "contact-form":
      return <p className="text-sm text-zinc-500">{f.contactForm}</p>;
  }
}

type EditablePage = { slug: string; title: L; description: L; blocks: Block[] };

export default function PageEditor({ page }: { page: EditablePage }) {
  const { t } = useAdminI18n();
  const p = t.pages;
  const [state, action, pending] = useActionState<PageFormState, FormData>(savePage, {});
  const [blocks, setBlocks] = useState<Block[]>(page.blocks);
  const [toAdd, setToAdd] = useState("text");

  // uploaded images come back with their new URLs
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with the saved result from the server
    if (state.blocks) setBlocks(state.blocks);
  }, [state.blocks]);

  const update = (i: number, b: Block) => setBlocks((list) => list.map((x, j) => (j === i ? b : x)));
  const move = (i: number, dir: -1 | 1) =>
    setBlocks((list) => {
      const next = [...list];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="slug" value={page.slug} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

      <Card title={p.page}>
        <div className="space-y-4">
          <LField label={p.titleLabel} name="title" required value={page.title} />
          <LField label={p.meta} name="description" value={page.description} />
        </div>
      </Card>

      {blocks.map((block, i) => (
        <Card
          key={i}
          title={`${i + 1}. ${p.blockLabels[block.type]}`}
          actions={
            <div className="flex gap-1 text-sm">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded px-2 py-1 hover:bg-zinc-100 disabled:opacity-30" aria-label={p.moveUp}>↑</button>
              <button type="button" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} className="rounded px-2 py-1 hover:bg-zinc-100 disabled:opacity-30" aria-label={p.moveDown}>↓</button>
              <button type="button" onClick={() => setBlocks((l) => l.filter((_, j) => j !== i))} className="rounded px-2 py-1 text-red-700 hover:bg-red-50">{t.common.delete}</button>
            </div>
          }
        >
          <BlockFields block={block} index={i} set={(b) => update(i, b)} />
        </Card>
      ))}

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-zinc-200 bg-zinc-50/95 py-4 backdrop-blur">
        <select value={toAdd} onChange={(e) => setToAdd(e.target.value)} className={`${inputCls} w-auto`}>
          {Object.keys(NEW_BLOCKS).map((k) => <option key={k} value={k}>{p.blockLabels[k]}</option>)}
        </select>
        <button type="button" onClick={() => setBlocks((l) => [...l, structuredClone(NEW_BLOCKS[toAdd])])} className={btnSecondaryCls}>
          {p.addBlock}
        </button>
        <div className="ms-auto flex items-center gap-3">
          <FormMessage state={state} />
          <button disabled={pending} className={btnCls}>{pending ? t.common.saving : p.savePage}</button>
        </div>
      </div>
    </form>
  );
}
