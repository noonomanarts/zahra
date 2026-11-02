import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { adminCatalogue } from "@/lib/data";
import { skuSuggestions } from "@/lib/sku";
import { getAdminT } from "@/lib/i18n/admin-server";
import { PageTitle } from "@/components/admin/ui";
import ProductForm from "../../products/ProductForm";

export const metadata: Metadata = { title: "New workshop" };

/** Name, price and images first; saving continues on the workshop page with its lessons and files. */
export default async function NewWorkshopPage() {
  await requireAdmin("workshops.manage");
  const { t } = await getAdminT();
  const [{ categories, tags }, skus] = await Promise.all([adminCatalogue(), skuSuggestions()]);
  return (
    <>
      <PageTitle title={t.workshops.add} description={t.workshops.newHint} back="/admin/workshops" backLabel={t.workshops.title} />
      <ProductForm categories={categories} tags={tags} kind="workshop" skus={skus} />
    </>
  );
}
