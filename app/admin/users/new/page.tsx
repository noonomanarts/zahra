import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { PageTitle } from "@/components/admin/ui";
import UserForm from "../UserForm";

export const metadata: Metadata = { title: "Add team member" };

export default async function NewUserPage() {
  const admin = await requireAdmin("users.manage");
  const { t } = await getAdminT();
  return (
    <>
      <PageTitle title={t.people.newTitle} description={t.people.newSubtitle} back="/admin/users" backLabel={t.people.back} />
      <UserForm actor={{ role: admin.role, permissions: admin.permissions }} />
    </>
  );
}
