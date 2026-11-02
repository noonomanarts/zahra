"use client";

/* eslint-disable @next/next/no-img-element -- admin previews, including local object URLs */
import DigitalFiles, { type SavedFile } from "./DigitalFiles";
import { useActionState, useState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Card, Field, FormMessage, LField, btnCls, inputCls } from "@/components/admin/ui";
import { CheckItem, ToggleField } from "@/components/admin/motion";
import SlugInput from "@/components/admin/SlugInput";
import { Icon } from "@/components/admin/icons";
import { Tip } from "@/components/admin/motion";
import { pick } from "@/lib/i18n/config";
import type { AdminProduct, AdminTerm } from "@/lib/data";
import { saveProduct, type ProductFormState } from "./actions";

type Props = { product?: AdminProduct; categories: AdminTerm[]; tags: AdminTerm[]; notice?: string; kind?: "product" | "workshop"; skus: Record<"digital" | "product" | "workshop", string> };

/** Products and workshops share this form; the type is fixed by where it is opened (Products or Workshops). */
export default function ProductForm({ product, categories, tags, notice, kind = product?.kind ?? "product", skus }: Props) {
  const { lang, t } = useAdminI18n();
  const p = t.products;
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProduct, notice ? { ok: notice } : {});
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [newFiles, setNewFiles] = useState<{ name: string; url: string }[]>([]);
  // SKU: the next number of the series (P digital, K kit/item, W workshop) until it is typed by hand
  const [digital, setDigital] = useState(product?.digital ?? false);
  const [digitalFiles, setDigitalFiles] = useState<SavedFile[]>((product?.digitalFiles ?? []).map(({ id, name, size }) => ({ id, name, size })));
  // after a save the server's list is the truth: renamed and newly uploaded files included
  const [savedFiles, setSavedFiles] = useState(state.digitalFiles);
  if (state.digitalFiles !== savedFiles) {
    setSavedFiles(state.digitalFiles);
    if (state.digitalFiles) setDigitalFiles(state.digitalFiles);
  }
  const [skuAuto, setSkuAuto] = useState(!product?.sku);
  const [skuManual, setSkuManual] = useState(product?.sku ?? "");
  // once saved the SKU is fixed: show what was stored, not the number after it
  const [savedSku, setSavedSku] = useState(state.sku);
  if (state.sku !== savedSku) {
    setSavedSku(state.sku);
    if (state.sku) {
      setSkuManual(state.sku);
      setSkuAuto(false);
    }
  }
  const sku = skuAuto ? skus[kind === "workshop" ? "workshop" : digital ? "digital" : "product"] : skuManual;
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
      <input type="hidden" name="kind" value={kind} />

      <div className="space-y-6">
        <Card title={p.details}>
          <div className="space-y-4">
            <LField label={p.name} name="name" required value={product && { en: product.name, ar: product.nameAr }} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={p.slug} hint={p.slugHint}>
                <SlugInput defaultValue={product?.slug} prefix="/products/" />
              </Field>
              <Field label={p.sku} hint={p.skuHint}>
                <div className="relative" dir="ltr">
                  <input
                    name="sku"
                    dir="ltr"
                    value={sku}
                    onChange={(e) => {
                      setSkuManual(e.target.value);
                      setSkuAuto(false);
                    }}
                    spellCheck={false}
                    autoComplete="off"
                    className={`${inputCls} pe-10 font-mono text-xs`}
                  />
                  {skuAuto && <input type="hidden" name="skuAuto" value="1" />}
                  <Tip label={skuAuto ? p.skuAuto : p.skuRegenerate}>
                    <button
                      type="button"
                      onClick={() => setSkuAuto(true)}
                      aria-label={p.skuRegenerate}
                      aria-pressed={skuAuto}
                      className={`absolute end-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md transition outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                        skuAuto ? "bg-brand-soft text-brand-ink" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
                      }`}
                    >
                      <Icon name={skuAuto ? "link" : "refresh"} size={15} />
                    </button>
                  </Tip>
                </div>
              </Field>
              <Field label={p.priceLabel}>
                <input name="price" type="number" dir="ltr" step="0.001" min="0" required defaultValue={product?.price} className={inputCls} />
              </Field>
              <Field label={p.regularPrice} hint={p.regularHint}>
                <input name="regularPrice" type="number" dir="ltr" step="0.001" min="0" defaultValue={product?.regularPrice ?? ""} className={inputCls} />
              </Field>
              <Field label={p.unitCost} hint={p.unitCostHint}>
                <input name="unitCost" type="number" dir="ltr" step="0.001" min="0" defaultValue={product?.unitCost ?? ""} className={inputCls} />
              </Field>
              {kind === "product" && !digital && (
                <Field label={p.stock} hint={p.stockHint}>
                  <input name="stock" type="number" dir="ltr" step="1" min="0" defaultValue={product?.stock ?? ""} className={inputCls} />
                </Field>
              )}
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
        {kind === "product" && digital && <DigitalFiles files={digitalFiles} onChange={setDigitalFiles} />}

        <Card title={p.statusCard}>
          <div className="space-y-4">
            <ToggleField name="published" label={p.published} defaultChecked={product?.published ?? true} />
            <ToggleField name="inStock" label={p.inStock} defaultChecked={product?.inStock ?? true} />
            {kind === "product" && <ToggleField name="digital" label={p.digital} defaultChecked={product?.digital ?? false} onCheckedChange={setDigital} />}
          </div>
          <div className="mt-5 space-y-3">
            <FormMessage state={state} />
            <button disabled={pending} className={`${btnCls} w-full`}>{pending ? t.common.saving : kind === "workshop" ? t.workshops.saveDetails : p.saveProduct}</button>
          </div>
        </Card>

        <Card title={t.nav.categories}>
          <div className="-mx-2 max-h-72 overflow-y-auto">
            {categories.map((c) => (
              <CheckItem key={c.id} name="categories" value={c.id} label={termName(c)} defaultChecked={product?.categories.includes(c.slug)} />
            ))}
          </div>
        </Card>

        <Card title={t.nav.tags}>
          <div className="-mx-2 max-h-72 overflow-y-auto">
            {tags.map((tag) => (
              <CheckItem key={tag.id} name="tags" value={tag.id} label={termName(tag)} defaultChecked={product?.tags.includes(tag.slug)} />
            ))}
          </div>
        </Card>
      </div>
    </form>
  );
}
