"use client";

/* eslint-disable @next/next/no-img-element -- admin previews, including local object URLs */
import { useActionState, useEffect, useState } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Card, Field, FormMessage, LField, btnCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { CheckItem, ToggleField } from "@/components/admin/motion";
import { pick } from "@/lib/i18n/config";
import type { AdminProduct, AdminTerm } from "@/lib/data";
import type { WorkshopVideo } from "@/lib/types";
import { saveProduct, type ProductFormState } from "./actions";

type Props = { product?: AdminProduct; categories: AdminTerm[]; tags: AdminTerm[]; notice?: string };

export default function ProductForm({ product, categories, tags, notice }: Props) {
  const { lang, t } = useAdminI18n();
  const p = t.products;
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProduct, notice ? { ok: notice } : {});
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [newFiles, setNewFiles] = useState<{ name: string; url: string }[]>([]);
  const [kind, setKind] = useState(product?.kind ?? "product");
  const [videos, setVideos] = useState<WorkshopVideo[]>(product?.workshopVideos ?? []);
  const [files, setFiles] = useState(product?.workshopFiles ?? []);
  // files uploaded by the last save come back from the server
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with the saved result
    if (state.workshopFiles) setFiles(state.workshopFiles);
  }, [state.workshopFiles]);
  const isYoutube = (url: string) => /(?:youtu\.be\/|[?&]v=|shorts\/|embed\/|live\/)[\w-]{11}/.test(url);
  const setVideo = (i: number, patch: Partial<WorkshopVideo>) => setVideos((list) => list.map((v, j) => (j === i ? { ...v, ...patch } : v)));
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
      <input type="hidden" name="workshopVideos" value={JSON.stringify(videos)} />
      <input type="hidden" name="workshopFiles" value={JSON.stringify(files.map((f) => ({ id: f.id })))} />

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
              <div className="sm:col-span-2">
                <Field label={p.unitCost} hint={p.unitCostHint}>
                  <input name="unitCost" type="number" dir="ltr" step="0.001" min="0" defaultValue={product?.unitCost ?? ""} className={`${inputCls} sm:max-w-[calc(50%-0.5rem)]`} />
                </Field>
              </div>
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
        {kind === "workshop" && (
          <Card title={p.workshop}>
            <p className="mb-5 text-xs text-zinc-500">{p.workshopHint}</p>
            <h3 className="mb-2 font-sans text-sm font-semibold text-zinc-800">{p.videos}</h3>
            <ol className="space-y-3">
              {videos.map((v, i) => (
                <li key={i} className="rounded-lg border border-zinc-200 p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">{i + 1}</span>
                    <div className="grid flex-1 gap-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input value={v.title.en} onChange={(e) => setVideo(i, { title: { ...v.title, en: e.target.value } })} placeholder={`${p.videoTitle} (EN)`} dir="ltr" lang="en" className={inputCls} />
                        <input value={v.title.ar} onChange={(e) => setVideo(i, { title: { ...v.title, ar: e.target.value } })} placeholder={`${p.videoTitle} (AR)`} dir="rtl" lang="ar" className={inputCls} />
                      </div>
                      <input
                        value={v.url}
                        onChange={(e) => setVideo(i, { url: e.target.value })}
                        placeholder="https://youtu.be/…"
                        dir="ltr"
                        aria-invalid={!!v.url && !isYoutube(v.url)}
                        className={`${inputCls} font-mono text-xs aria-[invalid=true]:border-red-400`}
                      />
                      {v.url && !isYoutube(v.url) && <span className="text-xs text-red-700">{p.invalidVideo}</span>}
                    </div>
                    <div className="flex flex-col gap-1 text-xs">
                      <button type="button" disabled={i === 0} onClick={() => setVideos((l) => { const n = [...l]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} className="rounded px-2 py-1 hover:bg-zinc-100 disabled:opacity-30" aria-label={t.pages.moveUp}>↑</button>
                      <button type="button" disabled={i === videos.length - 1} onClick={() => setVideos((l) => { const n = [...l]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })} className="rounded px-2 py-1 hover:bg-zinc-100 disabled:opacity-30" aria-label={t.pages.moveDown}>↓</button>
                      <button type="button" onClick={() => setVideos((l) => l.filter((_, j) => j !== i))} className="rounded px-2 py-1 text-red-700 hover:bg-red-50">{p.removeVideo}</button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => setVideos((l) => [...l, { title: { en: "", ar: "" }, url: "" }])} className={`${btnSecondaryCls} mt-3`}>+ {p.addVideo}</button>

            <h3 className="mt-8 mb-2 font-sans text-sm font-semibold text-zinc-800">{p.files}</h3>
            {files.length ? (
              <ul className="mb-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    {product ? (
                      <a href={`/api/workshops/${product.id}/files/${f.id}`} className="truncate hover:underline" dir="auto">{f.name}</a>
                    ) : (
                      <span className="truncate" dir="auto">{f.name}</span>
                    )}
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-zinc-500" dir="ltr">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button type="button" onClick={() => setFiles((l) => l.filter((x) => x.id !== f.id))} className="text-xs text-red-700 hover:underline">{p.remove}</button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm text-zinc-500">{p.noFiles}</p>
            )}
            <Field label={p.uploadFiles} hint={p.filesHint}>
              <input
                name="newWorkshopFiles"
                type="file"
                multiple
                accept=".pdf,.zip,image/jpeg,image/png,image/webp,application/pdf,application/zip"
                className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm hover:file:bg-zinc-200"
              />
            </Field>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card title={p.statusCard}>
          <fieldset className="mb-5">
            <legend className="mb-2 text-sm font-medium text-zinc-700">{p.kind}</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 text-sm">
              {(["product", "workshop"] as const).map((k) => (
                <label key={k} className={`cursor-pointer rounded-md px-2 py-1.5 text-center transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${kind === k ? "bg-white font-medium shadow-sm" : "text-zinc-600"}`}>
                  <input type="radio" name="kindChoice" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                  {k === "product" ? p.kindProduct.split(" (")[0] : p.kindWorkshop}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">{kind === "workshop" ? p.kindHint : p.kindProduct}</p>
          </fieldset>
          <div className="space-y-4 border-t border-zinc-100 pt-4">
            <ToggleField name="published" label={p.published} defaultChecked={product?.published ?? true} />
            <ToggleField name="inStock" label={p.inStock} defaultChecked={product?.inStock ?? true} />
            {kind === "product" && <ToggleField name="digital" label={p.digital} defaultChecked={product?.digital ?? false} />}
          </div>
          <div className="mt-5 space-y-3">
            <FormMessage state={state} />
            <button disabled={pending} className={`${btnCls} w-full`}>{pending ? t.common.saving : p.saveProduct}</button>
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
