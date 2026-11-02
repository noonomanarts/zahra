import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { btnCls, btnSecondaryCls } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";

export const metadata: Metadata = { title: "No access" };

export default async function ForbiddenPage() {
  await requireAdmin();
  const { t } = await getAdminT();
  const f = t.forbidden;
  return (
    <div className="zds-rise mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-zinc-100 text-zinc-400"><Icon name="shield" size={30} strokeWidth={1.4} /></span>
      <h1 className="mt-5 font-sans text-xl font-semibold text-zinc-900">{f.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">{f.text}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/admin" className={btnCls}>{f.back}</Link>
        <Link href="/admin/account" className={btnSecondaryCls}>{f.account}</Link>
      </div>
    </div>
  );
}
