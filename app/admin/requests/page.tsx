import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { REQUEST_STATUSES, type RequestStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/currency";
import { getAdminT } from "@/lib/i18n/admin-server";
import { Badge, PageTitle } from "@/components/admin/ui";
import { REQUEST_BADGE } from "./badges";
import { SlidingTabs } from "@/components/admin/motion";

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
  const counts = new Map(
    (await db.select({ status: schema.serviceRequests.status, n: count() }).from(schema.serviceRequests).groupBy(schema.serviceRequests.status)).map((x) => [x.status, x.n]),
  );
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" });

  return (
    <>
      <PageTitle title={r.title} description={r.intro} />
      <div className="mb-4">
        <SlidingTabs
          ariaLabel={r.status}
          value={filter ?? "all"}
          items={[
            { value: "all", label: r.all, href: "/admin/requests" },
            ...REQUEST_STATUSES.map((s) => ({ value: s, label: r.statuses[s], href: `/admin/requests?status=${s}`, count: counts.get(s) })),
          ]}
        />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,16,16,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50/70 text-xs font-medium tracking-wide text-zinc-500 uppercase rtl:tracking-normal">
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
