"use client";

/* eslint-disable @next/next/no-img-element -- admin previews, including local object URLs */
import { useActionState, useState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Card, Field, FormMessage, LField, btnCls, inputCls } from "@/components/admin/ui";
import { pick } from "@/lib/i18n/config";
import type { AdminProduct, AdminTerm } from "@/lib/data";
import { saveProduct, type ProductFormState } from "./actions";

type Props = { product?: AdminProduct; categories: AdminTerm[]; tags: AdminTerm[]; notice?: string };

export default function ProductForm({ product, categories, tags, notice }: Props) {
  const { lang, t } = useAdminI18n();
  const p = t.products;
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProduct, notice ? { ok: notice } : {});
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [newFiles, setNewFiles] = useState<{ name: string; url: string }[]>([]);
  const termName = (term: AdminTerm) => pick({ en: term.name, ar: term.nameAr }, lang);

  const move = (i: number, dir: -1 | 1) =>
    setImages((list) => {
      const next = [...list];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[1fr_320px]">
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      <div className="space-y-6">
        <Card title={p.details}>
          <div className="space-y-4">
            <LField label={p.name} name="name" required value={product && { en: product.name, ar: product.nameAr }} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={p.slug} hint={p.slugHint}>
                <input name="slug" dir="ltr" defaultValue={product?.slug} className={`${inputCls} font-mono text-xs`} />
              </Field>
              <Field label={p.sku}><input name="sku" dir="ltr" defaultValue={product?.sku ?? ""} className={inputCls} /></Field>
              <Field label={p.priceLabel}>
                <input name="price" type="number" dir="ltr" step="0.001" min="0" required defaultValue={product?.price} className={inputCls} />
              </Field>
              <Field label={p.regularPrice} hint={p.regularHint}>
                <input name="regularPrice" type="number" dir="ltr" step="0.001" min="0" defaultValue={product?.regularPrice ?? ""} className={inputCls} />
              </Field>
            </div>
          </div>
        </Card>

        <Card title={p.description}>
          <LField
            label="HTML"
            name="description"
            multiline
            rows={14}
            mono
            hint={p.descriptionHint}
            value={product && { en: product.description, ar: product.descriptionAr }}
          />
        </Card>

        <Card title={p.images}>
          <p className="mb-4 text-xs text-zinc-500">{p.imagesHint}</p>
          {images.length > 0 && (
            <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((src, i) => (
                <li key={src} className="overflow-hidden rounded-lg border border-zinc-200">
                  <img src={src} alt="" className="aspect-square w-full object-cover" />
                  <div className="flex items-center justify-between gap-1 p-1.5 text-xs">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded px-2 py-1 hover:bg-zinc-100 disabled:opacity-30" aria-label={p.moveLeft}>
                      <span className="inline-block rtl:rotate-180">←</span>
                    </button>
                    <button type="button" onClick={() => setImages((l) => l.filter((x) => x !== src))} className="rounded px-2 py-1 text-red-700 hover:bg-red-50">{p.remove}</button>
                    <button type="button" disabled={i === images.length - 1} onClick={() => move(i, 1)} className="rounded px-2 py-1 hover:bg-zinc-100 disabled:opacity-30" aria-label={p.moveRight}>
                      <span className="inline-block rtl:rotate-180">→</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Field label={p.upload} hint={p.uploadHint}>
            <input
              name="newImages"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              multiple
              onChange={(e) => setNewFiles([...(e.target.files ?? [])].map((f) => ({ name: f.name, url: URL.createObjectURL(f) })))}
              className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm hover:file:bg-zinc-200"
            />
          </Field>
          {newFiles.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {newFiles.map((f) => <li key={f.url}><img src={f.url} alt={f.name} className="h-16 w-16 rounded-lg object-cover" /></li>)}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title={p.statusCard}>
          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={product?.published ?? true} /> {p.published}</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="inStock" defaultChecked={product?.inStock ?? true} /> {p.inStock}</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="digital" defaultChecked={product?.digital ?? false} /> {p.digital}</label>
          </div>
          <div className="mt-5 space-y-3">
            <FormMessage state={state} />
            <button disabled={pending} className={`${btnCls} w-full`}>{pending ? t.common.saving : p.saveProduct}</button>
          </div>
        </Card>

        <Card title={t.nav.categories}>
          <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input type="checkbox" name="categories" value={c.id} defaultChecked={product?.categories.includes(c.slug)} /> {termName(c)}
              </label>
            ))}
          </div>
        </Card>

        <Card title={t.nav.tags}>
          <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2">
                <input type="checkbox" name="tags" value={tag.id} defaultChecked={product?.tags.includes(tag.slug)} /> {termName(tag)}
              </label>
            ))}
          </div>
        </Card>
      </div>
    </form>
  );
}
