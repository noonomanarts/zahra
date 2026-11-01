import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { adminCatalogue } from "@/lib/data";
import { getAdminT } from "@/lib/i18n/admin-server";
import { pick } from "@/lib/i18n/config";
import { Card, PageTitle, btnCls, btnDangerCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { workshopParticipants } from "@/lib/workshops";
import { ConfirmAction } from "@/components/admin/motion";
import { Icon } from "@/components/admin/icons";
import ProductForm from "../ProductForm";
import { deleteProduct, grantWorkshop, revokeWorkshop } from "../actions";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const { lang, t } = await getAdminT();
  const id = Number((await params).id);
  const { created, grant } = (await searchParams) as { created?: string; grant?: string };
  const { products, categories, tags } = await adminCatalogue();
  const product = products.find((p) => p.id === id);
  if (!product) notFound();
  const p = t.products;
  const people = product.kind === "workshop" ? await workshopParticipants(product.id) : null;

  return (
    <>
      <PageTitle
        title={pick({ en: product.name, ar: product.nameAr }, lang)}
        back="/admin/products"
        backLabel={t.common.back}
        actions={
          <>
            {product.published && (
              <>
                <Link href={`/en/products/${product.slug}`} target="_blank" className={btnSecondaryCls}>EN ↗</Link>
                <Link href={`/ar/products/${product.slug}`} target="_blank" className={btnSecondaryCls}>AR ↗</Link>
              </>
            )}
            <form id="delete-product" action={deleteProduct}>
              <input type="hidden" name="id" value={product.id} />
            </form>
            <ConfirmAction
              form="delete-product"
              className={btnDangerCls}
              trigger={<><Icon name="trash" size={16} /> {t.common.delete}</>}
              title={p.deleteTitle}
              description={p.deleteText(pick({ en: product.name, ar: product.nameAr }, lang))}
              confirm={p.deleteConfirm}
              cancel={t.common.cancel}
            />
          </>
        }
      />
      <ProductForm key={product.id} product={product} categories={categories} tags={tags} notice={created ? t.products.created : undefined} />
      {people && (
        <div id="participants" className="mt-6 scroll-mt-6 xl:max-w-[calc(100%-344px)]">
          <Card title={`${p.participants} (${people.bought.length + people.granted.length})`}>
            <p className="mb-4 text-xs text-zinc-500">{p.participantsHint}</p>
            {people.bought.length + people.granted.length ? (
              <ul className="mb-5 divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm">
                {people.bought.map((c) => (
                  <li key={`o${c.orderId}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>{c.name} <span className="text-zinc-500" dir="ltr">· {c.email}</span></span>
                    <Link href={`/admin/orders/${c.orderId}`} className="text-xs text-zinc-500 hover:underline">{p.viaOrder(c.order)}</Link>
                  </li>
                ))}
                {people.granted.map((c) => (
                  <li key={`g${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>{c.name} <span className="text-zinc-500" dir="ltr">· {c.email}</span></span>
                    <form action={revokeWorkshop} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500">{p.manual}</span>
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="customerId" value={c.id} />
                      <button className="text-xs text-red-700 hover:underline">{p.revoke}</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-5 text-sm text-zinc-500">{p.noParticipants}</p>
            )}
            <form action={grantWorkshop} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="productId" value={product.id} />
              <label className="min-w-64 flex-1">
                <span className="mb-1.5 block text-sm font-medium text-zinc-700">{p.grantHint}</span>
                <input name="email" type="email" required dir="ltr" className={inputCls} />
              </label>
              <button className={btnCls}>{p.grant}</button>
            </form>
            {grant === "ok" && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{p.granted}</p>}
            {grant === "missing" && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{p.noCustomer}</p>}
          </Card>
        </div>
      )}
    </>
  );
}
