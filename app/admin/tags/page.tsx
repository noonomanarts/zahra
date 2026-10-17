import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { adminCatalogue } from "@/lib/data";
import { getAdminT } from "@/lib/i18n/admin-server";
import { PageTitle } from "@/components/admin/ui";
import TermManager from "../terms/TermManager";

export const metadata: Metadata = { title: "Tags" };

export default async function Page() {
  await requireAdmin();
  const { t } = await getAdminT();
  const { tags } = await adminCatalogue();
  return (
    <>
      <PageTitle title={t.nav.tags} />
      <TermManager kind="tags" terms={tags} />
    </>
  );
}
