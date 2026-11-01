import { renderRichContent } from "@/lib/rich-content";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { accountDate } from "@/components/account/OrderList";
import WorkshopPlayer from "@/components/account/WorkshopPlayer";
import { requireCustomer } from "@/lib/customer-auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, localizeHref, pick } from "@/lib/i18n/config";
import { customerWorkshop, youtubeId } from "@/lib/workshops";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export default async function AccountWorkshopPage({ params }: PageProps<"/[lang]/account/workshops/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const customer = await requireCustomer(lang);
  const workshop = await customerWorkshop(customer.id, slug, lang);
  if (!workshop) notFound();
  const a = getDictionary(lang).account;
  const videos = workshop.videos
    .map((v, i) => ({ id: youtubeId(v.url) ?? "", title: pick(v.title, lang) || `${a.lessons} ${i + 1}` }))
    .filter((v) => v.id);

  return (
    <AccountShell lang={lang} customer={customer} active="workshops">
      <Link href={localizeHref(lang, "/account/workshops")} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <span aria-hidden="true" className="rtl:rotate-180">←</span> {a.backToWorkshops}
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {workshop.image && <Image src={workshop.image} alt="" width={64} height={64} className="h-16 w-16 rounded-2xl object-cover" />}
        <div>
          <h2 className="text-3xl font-bold">{workshop.name}</h2>
          <p className="mt-1 text-sm text-muted">{a.purchased(accountDate(lang, workshop.since))}</p>
        </div>
      </div>

      <div className="mt-8">
        {videos.length ? <WorkshopPlayer videos={videos} /> : <p className="rounded-3xl border border-dashed border-line p-8 text-center text-muted">{a.noVideos}</p>}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]">
        {workshop.description ? (
          <div className="prose-zahra markdown-content min-w-0" dangerouslySetInnerHTML={{ __html: renderRichContent(workshop.description, lang) }} />
        ) : (
          <div />
        )}
        <section className="h-fit rounded-3xl bg-brand-soft/60 p-6">
          <h3 className="font-sans text-lg font-semibold">{a.downloads}</h3>
          {workshop.files.length ? (
            <ul className="mt-4 space-y-2">
              {workshop.files.map((f) => (
                <li key={f.id}>
                  <a
                    href={`/api/workshops/${workshop.id}/files/${f.id}`}
                    download
                    className="flex items-center gap-3 rounded-2xl bg-white p-3 transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-dark"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-dark">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" /></svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" dir="auto">{f.name}</span>
                      <span className="block text-xs text-muted" dir="ltr">{size(f.size)}</span>
                    </span>
                    <span className="text-xs font-medium text-brand-dark">{a.download}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">{a.noFiles}</p>
          )}
        </section>
      </div>
    </AccountShell>
  );
}
