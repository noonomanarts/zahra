import Link from "next/link";
import Image from "next/image";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizeHref, type Locale } from "@/lib/i18n/config";

export default function AccountWorkshopCard({ lang, workshop, date }: {
  lang: Locale;
  workshop: { slug: string; name: string; image: string | null; videos: unknown[]; files: unknown[] };
  date: string;
}) {
  const t = getDictionary(lang);
  return (
    <Link
      href={localizeHref(lang, `/account/workshops/${workshop.slug}`)}
      className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-white transition hover:border-brand/40 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-dark"
    >
      <div className="relative aspect-video overflow-hidden bg-brand-soft">
        {workshop.image && <Image src={workshop.image} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
        <span className="absolute inset-0 grid place-items-center bg-ink/0 transition-colors group-hover:bg-ink/20" aria-hidden="true">
          <span className="grid h-14 w-14 scale-90 place-items-center rounded-full bg-white/95 opacity-0 shadow-xl transition group-hover:scale-100 group-hover:opacity-100">
            <svg width="22" height="22" viewBox="0 0 24 24" className="ms-0.5 text-brand-dark"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
          </span>
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-sans text-lg leading-snug font-semibold group-hover:text-brand-dark">{workshop.name}</h3>
        <p className="mt-1 text-xs text-muted">{t.account.purchased(date)}</p>
        <p className="mt-auto flex flex-wrap gap-x-4 pt-4 text-sm text-muted">
          <span>{t.workshops.videos(workshop.videos.length)}</span>
          <span>{t.workshops.files(workshop.files.length)}</span>
        </p>
      </div>
    </Link>
  );
}
