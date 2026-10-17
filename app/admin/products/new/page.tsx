import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { adminCatalogue } from "@/lib/data";
import { getAdminT } from "@/lib/i18n/admin-server";
import { PageTitle } from "@/components/admin/ui";
import ProductForm from "../ProductForm";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireAdmin();
  const { t } = await getAdminT();
  const { categories, tags } = await adminCatalogue();
  return (
    <>
      <PageTitle title={t.products.new} back="/admin/products" backLabel={t.common.back} />
      <ProductForm categories={categories} tags={tags} />
    </>
  );
}
