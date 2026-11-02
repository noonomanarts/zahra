import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { adminCatalogue } from "@/lib/data";
import { getAdminT } from "@/lib/i18n/admin-server";
import { PageTitle, ReadOnly } from "@/components/admin/ui";
import TermManager from "../terms/TermManager";

export const metadata: Metadata = { title: "Tags" };

export default async function Page() {
  const admin = await requireAdmin("taxonomy.view");
  const editable = can(admin.permissions, "taxonomy.manage");
  const { t } = await getAdminT();
  const { tags } = await adminCatalogue();
  return (
    <>
      <PageTitle title={t.nav.tags} />
      <ReadOnly when={!editable} label={t.common.readOnly}><TermManager kind="tags" terms={tags} /></ReadOnly>
    </>
  );
}
