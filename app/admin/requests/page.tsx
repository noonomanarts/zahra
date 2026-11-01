import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { REQUEST_STATUSES, type RequestStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/currency";
import { getAdminT } from "@/lib/i18n/admin-server";
import { Badge, PageTitle } from "@/components/admin/ui";
import { REQUEST_BADGE } from "./badges";

export const metadata: Metadata = { title: "Requests" };

export default async function RequestsPage({ searchParams }: PageProps<"/admin/requests">) {
  await requireAdmin();
  const { lang, t } = await getAdminT();
  const r = t.requests;
  const { status } = (await searchParams) as { status?: string };
  const filter = REQUEST_STATUSES.includes(status as RequestStatus) ? (status as RequestStatus) : null;
  const rows = await db
    .select()
    .from(schema.serviceRequests)
    .where(filter ? eq(schema.serviceRequests.status, filter) : undefined)
    .orderBy(desc(schema.serviceRequests.createdAt));
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" });

  return (
    <>
      <PageTitle title={r.title} />
      <p className="-mt-3 mb-5 max-w-3xl text-sm text-zinc-500">{r.intro}</p>
      <nav className="mb-4 flex flex-wrap gap-1 text-sm">
        {[null, ...REQUEST_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/admin/requests?status=${s}` : "/admin/requests"}
            className={`rounded-lg px-3 py-1.5 ${filter === s ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
          >
            {s ? r.statuses[s] : r.all}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-start">{r.number}</th>
              <th className="px-4 py-3 text-start">{r.type}</th>
              <th className="px-4 py-3 text-start">{r.date}</th>
              <th className="px-4 py-3 text-start">{r.customer}</th>
              <th className="px-4 py-3 text-start">{r.status}</th>
              <th className="px-4 py-3 text-end">{r.estimate}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.id} className={`hover:bg-zinc-50 ${row.status === "new" ? "font-medium" : ""}`}>
                <td className="px-4 py-2.5"><Link href={`/admin/requests/${row.id}`} className="hover:underline" dir="ltr">{row.number}</Link></td>
                <td className="px-4 py-2.5">{r.types[row.type]}</td>
                <td className="px-4 py-2.5 text-zinc-500">{dateFmt.format(row.createdAt)}</td>
                <td className="px-4 py-2.5">{row.name}<span className="block text-xs font-normal text-zinc-500" dir="ltr">{row.phone}</span></td>
                <td className="px-4 py-2.5"><Badge status={REQUEST_BADGE[row.status]} label={r.statuses[row.status]} /></td>
                <td className="px-4 py-2.5 text-end whitespace-nowrap">{row.estimate !== null ? <bdi>{formatMoney(row.estimate, "OMR", lang)}</bdi> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-6 text-center text-sm text-zinc-500">{r.none}</p>}
      </div>
    </>
  );
}
