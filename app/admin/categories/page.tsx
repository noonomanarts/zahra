import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { adminCatalogue } from "@/lib/data";
import { getAdminT } from "@/lib/i18n/admin-server";
import { PageTitle } from "@/components/admin/ui";
import TermManager from "../terms/TermManager";

export const metadata: Metadata = { title: "Categories" };

export default async function Page() {
  await requireAdmin();
  const { t } = await getAdminT();
  const { categories } = await adminCatalogue();
  return (
    <>
      <PageTitle title={t.nav.categories} />
      <TermManager kind="categories" terms={categories} />
    </>
  );
}
