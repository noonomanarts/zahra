/* eslint-disable @next/next/no-img-element -- small admin thumbnails */
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { adminCatalogue } from "@/lib/data";
import { formatMoney } from "@/lib/currency";
import { getAdminT } from "@/lib/i18n/admin-server";
import { pick } from "@/lib/i18n/config";
import { Badge, PageTitle, btnCls, inputCls } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();
  const { lang, t } = await getAdminT();
  const p = t.products;
  const { q = "", category = "", missing = "" } = (await searchParams) as { q?: string; category?: string; missing?: string };
  const { products, categories } = await adminCatalogue();
  const term = q.toLowerCase();
  const list = products.filter(
    (x) =>
      (!term || x.name.toLowerCase().includes(term) || x.nameAr.includes(q) || x.sku?.toLowerCase().includes(term)) &&
      (!category || x.categories.includes(category)) &&
      (missing !== "ar" || !x.nameAr || !x.descriptionAr),
  );
  const catName = new Map(categories.map((c) => [c.slug, pick({ en: c.name, ar: c.nameAr }, lang)]));

  return (
    <>
      <PageTitle title={p.title(list.length)} actions={<Link href="/admin/products/new" className={btnCls}>{p.add}</Link>} />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder={p.search} className={`${inputCls} max-w-xs`} />
        <select name="category" defaultValue={category} className={`${inputCls} max-w-xs`}>
          <option value="">{p.allCategories}</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{catName.get(c.slug)}</option>)}
        </select>
        <label className="flex items-center gap-2 px-2 text-sm text-zinc-600">
          <input type="checkbox" name="missing" value="ar" defaultChecked={missing === "ar"} /> {t.common.missingArabic}
        </label>
        <button className={btnCls}>{t.common.filter}</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-start">{p.product}</th>
              <th className="px-4 py-3 text-start">{p.sku}</th>
              <th className="px-4 py-3 text-start">{p.category}</th>
              <th className="px-4 py-3 text-start">{p.status}</th>
              <th className="px-4 py-3 text-end">{p.price}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {list.map((x) => (
              <tr key={x.id} className="hover:bg-zinc-50">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/products/${x.id}`} className="flex items-center gap-3 hover:underline">
                    {x.images[0] ? <img src={x.images[0]} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" /> : <span className="h-10 w-10 shrink-0 rounded-md bg-zinc-100" />}
                    <span>
                      <span className="block font-medium">{pick({ en: x.name, ar: x.nameAr }, lang)}</span>
                      {lang === "en" ? x.nameAr && <span className="block text-xs text-zinc-500" dir="rtl" lang="ar">{x.nameAr}</span> : <span className="block text-xs text-zinc-500" dir="ltr">{x.name}</span>}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-zinc-500" dir="ltr">{x.sku}</td>
                <td className="px-4 py-2.5 text-zinc-500">{x.categories.map((c) => catName.get(c)).join(lang === "ar" ? "، " : ", ")}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    <Badge status={x.published ? "published" : "draft"} label={t.status[x.published ? "published" : "draft"]} />
                    {!x.inStock && <Badge status="outOfStock" label={t.status.outOfStock} />}
                    {(!x.nameAr || !x.descriptionAr) && <Badge status="warning" label={t.common.missingArabic} />}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-end whitespace-nowrap">
                  {x.regularPrice && <del className="me-2 text-zinc-400"><bdi>{formatMoney(x.regularPrice, "OMR", lang)}</bdi></del>}
                  <bdi>{formatMoney(x.price, "OMR", lang)}</bdi>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <p className="p-6 text-center text-sm text-zinc-500">{p.noMatch}</p>}
      </div>
    </>
  );
}
