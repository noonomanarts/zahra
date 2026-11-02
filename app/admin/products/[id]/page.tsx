import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { adminCatalogue } from "@/lib/data";
import { skuSuggestions } from "@/lib/sku";
import { getAdminT } from "@/lib/i18n/admin-server";
import { pick } from "@/lib/i18n/config";
import { PageTitle, btnDangerCls, btnSecondaryCls } from "@/components/admin/ui";
import { ConfirmAction } from "@/components/admin/motion";
import { Icon } from "@/components/admin/icons";
import ProductForm from "../ProductForm";
import { deleteProduct } from "../actions";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const { lang, t } = await getAdminT();
  const id = Number((await params).id);
  const { created } = (await searchParams) as { created?: string };
  const [{ products, categories, tags }, skus] = await Promise.all([adminCatalogue(), skuSuggestions()]);
  const product = products.find((p) => p.id === id);
  if (!product) notFound();
  // workshops are edited in their own section
  if (product.kind === "workshop") redirect(`/admin/workshops/${product.id}?tab=details`);
  const p = t.products;

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
      <ProductForm key={product.id} product={product} categories={categories} tags={tags} skus={skus} notice={created ? t.products.created : undefined} />
    </>
  );
}
