import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { adminCatalogue } from "@/lib/data";
import { getAdminT } from "@/lib/i18n/admin-server";
import { PageTitle, ReadOnly } from "@/components/admin/ui";
import TermManager from "../terms/TermManager";

export const metadata: Metadata = { title: "Categories" };

export default async function Page() {
  const admin = await requireAdmin("taxonomy.view");
  const editable = can(admin.permissions, "taxonomy.manage");
  const { t } = await getAdminT();
  const { categories } = await adminCatalogue();
  return (
    <>
      <PageTitle title={t.nav.categories} />
      <ReadOnly when={!editable} label={t.common.readOnly}><TermManager kind="categories" terms={categories} /></ReadOnly>
    </>
  );
}
