import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { adminCatalogue } from "@/lib/data";
import { getAdminT } from "@/lib/i18n/admin-server";
import { pick } from "@/lib/i18n/config";
import { PageTitle, btnDangerCls, btnSecondaryCls } from "@/components/admin/ui";
import ProductForm from "../ProductForm";
import { deleteProduct } from "../actions";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const { lang, t } = await getAdminT();
  const id = Number((await params).id);
  const { created } = (await searchParams) as { created?: string };
  const { products, categories, tags } = await adminCatalogue();
  const product = products.find((p) => p.id === id);
  if (!product) notFound();

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
            <form action={deleteProduct}>
              <input type="hidden" name="id" value={product.id} />
              <button className={btnDangerCls}>{t.common.delete}</button>
            </form>
          </>
        }
      />
      <ProductForm key={product.id} product={product} categories={categories} tags={tags} notice={created ? t.products.created : undefined} />
    </>
  );
}
