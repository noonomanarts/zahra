import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { pick } from "@/lib/i18n/config";
import { Badge, PageTitle } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesPage() {
  await requireAdmin();
  const { lang, t } = await getAdminT();
  const pages = await db.select().from(schema.pages).orderBy(asc(schema.pages.slug));
  const sorted = [...pages.filter((p) => p.slug === "home"), ...pages.filter((p) => p.slug !== "home")];

  return (
    <>
      <PageTitle title={t.pages.title} />
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <ul className="divide-y divide-zinc-100">
          {sorted.map((p) => {
            const path = p.slug === "home" ? "" : `/${p.slug}`;
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 hover:bg-zinc-50">
                <Link href={`/admin/pages/${p.slug}`} className="font-medium hover:underline">
                  {p.slug === "home" ? t.pages.home : pick({ en: p.title, ar: p.titleAr }, lang)}
                </Link>
                <span className="flex items-center gap-4 text-sm text-zinc-500">
                  {!p.titleAr && <Badge status="warning" label={t.common.missingArabic} />}
                  {t.pages.blocks(p.blocks.length)}
                  <a href={`/en${path}`} target="_blank" className="hover:text-zinc-900">EN ↗</a>
                  <a href={`/ar${path}`} target="_blank" className="hover:text-zinc-900">AR ↗</a>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
