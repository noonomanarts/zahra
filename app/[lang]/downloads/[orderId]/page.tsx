import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { DOWNLOAD_LINK_DAYS, downloadAccess, orderDeliverables } from "@/lib/downloads";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref, pick } from "@/lib/i18n/config";

// the key is in the address, so it must not travel in a Referer header or reach a search engine
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

const size = (bytes: number) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(Math.round(bytes / 1024), 1)} KB`);

export default async function DownloadsPage({ params, searchParams }: PageProps<"/[lang]/downloads/[orderId]">) {
  const { lang, orderId } = await params;
  if (!isLocale(lang)) notFound();
  const d = getDictionary(lang).downloads;
  const id = Number(orderId);
  const order = Number.isInteger(id) ? await db.query.orders.findFirst({ where: eq(schema.orders.id, id) }) : undefined;
  const key = (await searchParams).key;
  const access = order ? await downloadAccess(order, key) : "denied";
  if (!order || access === "denied") notFound();
  const { files, manual } = await orderDeliverables(order.id);
  const query = typeof key === "string" ? `?key=${encodeURIComponent(key)}` : "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold">{d.title}</h1>
      <p className="mt-2 text-muted"><bdi dir="ltr">{order.number}</bdi></p>
      {access === "allowed" ? (
        <>
          {files.length > 0 && (
            <ul className="mt-8 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
              {files.map((f) => (
                <li key={`${f.productId}-${f.id}`} className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="font-semibold">{pick({ en: f.productName, ar: f.productNameAr }, lang)}</p>
                    <p className="mt-0.5 truncate text-sm text-muted" dir="auto">{f.name} · <bdi dir="ltr">{size(f.size)}</bdi></p>
                  </div>
                  <a href={`/api/downloads/${order.id}/${f.productId}/${f.id}${query}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-dark px-6 text-sm font-medium text-white transition hover:bg-ink">{d.download}</a>
                </li>
              ))}
            </ul>
          )}
          {manual.length > 0 && <p className="mt-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{d.manual(manual.join(lang === "ar" ? "، " : ", "))}</p>}
          {!files.length && !manual.length && <p className="mt-6 text-muted">{d.none}</p>}
          {query && <p className="mt-6 text-sm text-muted">{d.linkNote(DOWNLOAD_LINK_DAYS)}</p>}
        </>
      ) : (
        <p className="mt-8 rounded-2xl bg-amber-50 px-4 py-3 text-amber-900">{access === "unpaid" ? d.unpaid : d.expired}</p>
      )}
      <p className="mt-8"><Link href={localizeHref(lang, "/contact-us")} className="text-sm underline underline-offset-4">{d.help}</Link></p>
    </div>
  );
}
