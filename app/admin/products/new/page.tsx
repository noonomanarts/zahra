import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { adminCatalogue } from "@/lib/data";
import { skuSuggestions } from "@/lib/sku";
import { getAdminT } from "@/lib/i18n/admin-server";
import { PageTitle } from "@/components/admin/ui";
import ProductForm from "../ProductForm";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage({ searchParams }: PageProps<"/admin/products/new">) {
  await requireAdmin();
  // workshops are created in their own section
  if ((await searchParams).kind === "workshop") redirect("/admin/workshops/new");
  const { t } = await getAdminT();
  const [{ categories, tags }, skus] = await Promise.all([adminCatalogue(), skuSuggestions()]);
  return (
    <>
      <PageTitle title={t.products.new} back="/admin/products" backLabel={t.common.back} />
      <ProductForm categories={categories} tags={tags} kind="product" skus={skus} />
    </>
  );
}
