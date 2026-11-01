import Link from "next/link";
import Image from "next/image";
import { sectionHref, type Department, type Section } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizeHref, pick, type Locale } from "@/lib/i18n/config";
import { whatsappUrl } from "@/lib/whatsapp";

const pill = (active: boolean) =>
  `inline-flex min-h-10 items-center whitespace-nowrap rounded-full border px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark ${
    active ? "border-brand-dark bg-brand-dark text-white" : "border-brand/30 bg-white text-ink hover:border-brand hover:bg-brand hover:text-white"
  }`;

/** Sibling sections of a department, as a pill bar that scrolls sideways on small screens. */
export function SectionTabs({ department, current, lang }: { department: Department; current?: string; lang: Locale }) {
  const t = getDictionary(lang);
  return (
    <nav aria-label={pick(department.label, lang)} className="-mx-4 mt-8 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        <li>
          <Link href={localizeHref(lang, `/${department.slug}`)} aria-current={!current ? "page" : undefined} className={pill(!current)}>
            {t.shop.browseAll(pick(department.label, lang))}
          </Link>
        </li>
        {department.sections.map((s) => (
          <li key={s.slug}>
            <Link href={localizeHref(lang, sectionHref(department, s))} aria-current={current === s.slug ? "page" : undefined} className={pill(current === s.slug)}>
              {pick(s.label, lang)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  "custom-pattern": <path d="M4 20 20 4M9 4h11v11M4 9l5 5M8 17l-1 3 3-1" />,
  "print-design": (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="5" strokeDasharray="2 2" />
      <path d="M12 2v2M12 20v2" />
    </>
  ),
  free: <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />,
};

/** Card for a section on a department page: a product photo, or an icon for service pages. */
export function SectionCard({
  department,
  section,
  lang,
  image,
  count,
}: {
  department: Department;
  section: Section;
  lang: Locale;
  image: string | null;
  count: number | null;
}) {
  const t = getDictionary(lang);
  const icon = "service" in section ? ICONS[section.service] : "href" in section ? ICONS.free : null;
  return (
    <Link
      href={localizeHref(lang, sectionHref(department, section))}
      className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-white transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-dark motion-reduce:transform-none"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-brand-soft to-header/70">
        {image ? (
          <Image src={image} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" className="text-brand-dark/70" aria-hidden="true">
              {icon ?? <path d="M5 5l14 14M19 5 5 19" strokeDasharray="2.5 2" />}
            </svg>
          </div>
        )}
        {"service" in section && (
          <span className="absolute start-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-brand-dark shadow-sm">{t.shop.service}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="flex items-center justify-between gap-3 font-sans text-lg font-semibold">
          {pick(section.label, lang)}
          <span aria-hidden="true" className="text-brand transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1">→</span>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{pick(section.intro, lang)}</p>
        {count !== null && (
          <p className="mt-auto pt-4 text-xs font-medium tracking-wide text-brand-dark">{count ? t.shop.itemsCount(count) : t.shop.comingSoon}</p>
        )}
      </div>
    </Link>
  );
}

/** Shown while a collection has no products yet – keeps the visitor in touch instead of a dead end. */
export function EmptyCollection({ lang, whatsapp, title, text }: { lang: Locale; whatsapp: string; title: string; text?: { title: string; body: string } }) {
  const t = getDictionary(lang);
  const chat = whatsappUrl(whatsapp, `${t.whatsapp.hello}${title}`);
  return (
    <div className="rounded-3xl border border-dashed border-brand/40 bg-brand-soft/40 px-6 py-14 text-center sm:py-20">
      <svg className="mx-auto text-brand" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="32" cy="32" r="22" strokeDasharray="5 5" className="zds-stitch" />
        <path d="M32 21v11l7 5" />
      </svg>
      <p className="mt-5 font-script text-3xl text-brand">{t.shop.comingSoon}</p>
      <h2 className="mt-1 text-2xl font-bold">{text?.title ?? t.shop.emptyTitle}</h2>
      <p className="mx-auto mt-3 max-w-md text-muted">{text?.body ?? t.shop.emptyText}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {chat && (
          <a href={chat} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-whatsapp px-6 text-white transition-colors hover:bg-whatsapp-dark">
            <WhatsAppIcon /> {t.whatsapp.chat}
          </a>
        )}
        <Link href={localizeHref(lang, "/shop")} className="inline-flex min-h-12 items-center rounded-full border border-brand-dark/30 bg-white px-6 text-brand-dark transition-colors hover:bg-brand-soft">
          {t.notFound.browse}
        </Link>
      </div>
    </div>
  );
}

export function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.26-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.17-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}
