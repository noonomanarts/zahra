import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getPageRaw } from "@/lib/data";
import { getAdminT } from "@/lib/i18n/admin-server";
import { pick } from "@/lib/i18n/config";
import { PageTitle } from "@/components/admin/ui";
import PageEditor from "../PageEditor";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditPagePage({ params }: PageProps<"/admin/pages/[slug]">) {
  await requireAdmin();
  const { lang, t } = await getAdminT();
  const page = await getPageRaw((await params).slug);
  if (!page) notFound();
  return (
    <>
      <PageTitle title={page.slug === "home" ? t.pages.home : pick(page.title, lang)} back="/admin/pages" backLabel={t.common.back} />
      <PageEditor key={page.slug} page={page} />
    </>
  );
}
