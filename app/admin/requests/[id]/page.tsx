/* eslint-disable @next/next/no-img-element -- previews of uploaded attachments */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/currency";
import { getAdminT } from "@/lib/i18n/admin-server";
import { LOCALE_NAMES, isLocale } from "@/lib/i18n/config";
import { whatsappUrl } from "@/lib/whatsapp";
import { Badge, Card, PageTitle, btnSecondaryCls } from "@/components/admin/ui";
import { REQUEST_BADGE } from "../badges";
import RequestForm from "../RequestForm";

export const metadata: Metadata = { title: "Request" };

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export default async function RequestPage({ params }: PageProps<"/admin/requests/[id]">) {
  await requireAdmin();
  const { lang, t } = await getAdminT();
  const r = t.requests;
  const id = Number((await params).id);
  const row = await db.query.serviceRequests.findFirst({ where: eq(schema.serviceRequests.id, id) });
  if (!row) notFound();
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" });
  const chat = whatsappUrl(row.phone.replace(/\D/g, ""), r.quoteMessage(row.name, row.number));
  const order = ["aidaCount", "dimensions", "colours", "fabric", "hoop", "service", "pieces", "description", "changes", "notes", "fullKit", "country", "city", "address"];
  const details = Object.entries(row.details)
    .filter(([, v]) => v)
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));

  return (
    <>
      <PageTitle
        title={`${r.types[row.type]} · ${row.number}`}
        back="/admin/requests"
        backLabel={t.common.back}
        actions={<Badge status={REQUEST_BADGE[row.status]} label={r.statuses[row.status]} />}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title={r.details}>
            <dl className="divide-y divide-zinc-100 text-sm">
              {details.map(([k, v]) => (
                <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr]">
                  <dt className="text-zinc-500">{r.fields[k] ?? k}</dt>
                  <dd className="whitespace-pre-wrap" dir="auto">{r.values[v] ?? v}</dd>
                </div>
              ))}
              {row.estimate !== null && (
                <div className="grid gap-1 py-2.5 font-semibold sm:grid-cols-[200px_1fr]">
                  <dt>{r.estimate}</dt>
                  <dd><bdi>{formatMoney(row.estimate, "OMR", lang)}</bdi></dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title={r.files}>
            {row.files.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {row.files.map((f, i) => {
                  const url = `/admin/requests/${row.id}/files/${i}`;
                  const preview = /^image\/(jpeg|png|webp|gif|avif)$/.test(f.type);
                  return (
                    <li key={f.file} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2">
                      {preview ? (
                        <img src={url} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="grid h-16 w-16 shrink-0 place-items-center rounded bg-zinc-100 text-xs font-semibold text-zinc-500 uppercase">{f.name.split(".").pop()}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm" dir="auto">{f.name}</p>
                        <p className="text-xs text-zinc-500" dir="ltr">{size(f.size)}</p>
                        <div className="mt-1 flex gap-3 text-xs">
                          {preview && <a href={url} target="_blank" rel="noopener" className="text-zinc-700 underline">{r.open}</a>}
                          <a href={`${url}?download`} className="text-zinc-700 underline">{r.download}</a>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">{r.noFiles}</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={r.contact}>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-zinc-500">{t.orders.name}</dt><dd>{row.name}</dd></div>
              <div><dt className="text-xs text-zinc-500">{t.orders.email}</dt><dd dir="ltr" className="rtl:text-right"><a href={`mailto:${row.email}`} className="hover:underline">{row.email}</a></dd></div>
              <div><dt className="text-xs text-zinc-500">{t.orders.phone}</dt><dd dir="ltr" className="rtl:text-right">{row.phone}</dd></div>
              <div><dt className="text-xs text-zinc-500">{r.language}</dt><dd>{isLocale(row.locale) ? LOCALE_NAMES[row.locale] : row.locale}</dd></div>
              <div><dt className="text-xs text-zinc-500">{r.date}</dt><dd>{dateFmt.format(row.createdAt)}</dd></div>
            </dl>
            {chat && (
              <a href={chat} target="_blank" rel="noopener noreferrer" className={`${btnSecondaryCls} mt-4 w-full border-emerald-300 text-emerald-800 hover:bg-emerald-50`}>
                {r.whatsapp} ↗
              </a>
            )}
          </Card>
          <Card title={r.status}>
            <RequestForm id={row.id} status={row.status} notes={row.adminNotes} />
          </Card>
        </div>
      </div>
    </>
  );
}
