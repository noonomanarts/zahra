/* eslint-disable @next/next/no-img-element -- admin thumbnails from the site's own uploads */
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/currency";
import { getAdminT } from "@/lib/i18n/admin-server";
import { pick } from "@/lib/i18n/config";
import { adminWorkshops } from "@/lib/workshops";
import { Badge, PageTitle, Stat, btnCls } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { Count } from "@/components/admin/motion";

export const metadata: Metadata = { title: "Workshops" };

export default async function WorkshopsPage() {
  await requireAdmin();
  const { lang, t } = await getAdminT();
  const w = t.workshops;
  const { list, totals } = await adminWorkshops();
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Muscat" });
  const currencyLabel = lang === "ar" ? " ر.ع." : "OMR ";
  const add = (
    <Link href="/admin/workshops/new" className={btnCls}>
      <Icon name="plus" size={16} /> {w.add}
    </Link>
  );

  return (
    <>
      <PageTitle title={w.title} description={w.subtitle} actions={add} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={w.stats.workshops} tone="rose" icon={<Icon name="workshops" />} value={<Count value={totals.workshops} />} hint={w.publishedOf(totals.published, totals.workshops)} />
        <Stat label={w.stats.students} tone="sky" icon={<Icon name="users" />} value={<Count value={totals.students} />} hint={w.studentsHint} />
        <Stat
          label={w.stats.revenue}
          tone="emerald"
          icon={<Icon name="wallet" />}
          value={<Count value={totals.revenue} decimals={3} prefix={lang === "ar" ? undefined : currencyLabel} suffix={lang === "ar" ? currencyLabel : undefined} />}
          hint={w.revenueHint}
        />
        <Stat label={w.stats.lessons} tone="amber" icon={<Icon name="video" />} value={<Count value={totals.lessons} />} hint={w.filesHint(totals.files)} />
      </div>

      {list.length ? (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((x) => {
            const name = pick({ en: x.name, ar: x.nameAr }, lang);
            const empty = !x.workshopVideos.length && !x.workshopFiles.length;
            const reasons = [...(x.published && empty ? [w.attentionEmpty] : []), ...(x.unlinked ? [w.attentionUnlinked(x.unlinked)] : [])];
            return (
              <li key={x.id} className="zds-rise">
                <Link
                  href={`/admin/workshops/${x.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,16,16,0.04)] transition duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 motion-reduce:transform-none"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-brand-soft to-zinc-100">
                    {x.images[0] ? (
                      <>
                        <img src={x.images[0]} alt="" className="size-full object-cover transition duration-500 group-hover:scale-[1.04] motion-reduce:transform-none" />
                        <span className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" aria-hidden="true" />
                      </>
                    ) : (
                      <span className="grid size-full place-items-center text-brand-ink/40"><Icon name="workshops" size={44} strokeWidth={1.2} /></span>
                    )}
                    <div className="absolute start-3 top-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-white shadow-sm"><Badge status={x.published ? "published" : "draft"} label={t.status[x.published ? "published" : "draft"]} /></span>
                      {reasons.length > 0 && <span className="rounded-full bg-white shadow-sm"><Badge status="warning" label={w.attention} /></span>}
                    </div>
                    <span className="absolute end-3 bottom-3 rounded-full bg-white/95 px-2.5 py-1 text-sm font-semibold text-zinc-900 shadow-sm">
                      <bdi>{formatMoney(x.price, "OMR", lang)}</bdi>
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="font-sans text-base leading-snug font-semibold text-zinc-900">{name}</h2>
                    {lang === "en" ? x.nameAr && <p className="mt-0.5 truncate text-xs text-zinc-500" dir="rtl" lang="ar">{x.nameAr}</p> : <p className="mt-0.5 truncate text-xs text-zinc-500" dir="ltr">{x.name}</p>}

                    {reasons.length > 0 && (
                      <ul className="mt-3 space-y-1 text-xs text-amber-800">
                        {reasons.map((r) => (
                          <li key={r} className="flex items-center gap-1.5"><Icon name="alert" size={13} className="shrink-0" /> {r}</li>
                        ))}
                      </ul>
                    )}

                    <dl className="mt-4 mb-4 grid grid-cols-3 gap-2 text-center">
                      {[
                        { icon: "video" as const, value: x.workshopVideos.length, label: w.stats.lessons },
                        { icon: "file" as const, value: x.workshopFiles.length, label: w.files },
                        { icon: "users" as const, value: x.students, label: w.stats.students },
                      ].map((m) => (
                        <div key={m.icon} className="rounded-xl bg-zinc-50 px-2 py-2.5 ring-1 ring-zinc-100">
                          <dt className="flex items-center justify-center gap-1 text-[11px] text-zinc-500"><Icon name={m.icon} size={13} /> {m.label}</dt>
                          <dd className="mt-1 text-lg leading-none font-semibold text-zinc-900 tabular-nums">{m.value}</dd>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-xs text-zinc-500">
                      <span>{x.lastJoined ? w.lastJoined(dateFmt.format(x.lastJoined)) : w.noStudents}</span>
                      <span className="flex items-center gap-1 font-medium text-zinc-900">
                        {w.manage} <Icon name="arrow" size={15} className="transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="zds-rise mt-6 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-ink"><Icon name="workshops" size={26} /></span>
          <div>
            <h2 className="font-sans text-base font-semibold text-zinc-900">{w.none}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">{w.noneHint}</p>
          </div>
          {add}
        </div>
      )}
    </>
  );
}
