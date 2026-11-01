import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizeHref, type Locale } from "@/lib/i18n/config";

export default function PageHeader({
  title,
  lang,
  crumbs = [],
  eyebrow,
  intro,
  children,
}: {
  title: string;
  lang: Locale;
  crumbs?: { label: string; href: string }[];
  eyebrow?: string;
  intro?: string;
  children?: React.ReactNode;
}) {
  const t = getDictionary(lang);
  return (
    <section className="bg-brand-soft">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <nav aria-label={t.nav.breadcrumb}>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {[{ label: t.nav.home, href: "/" }, ...crumbs].map((c) => (
              <li key={c.href} className="flex items-center gap-2">
                <Link href={localizeHref(lang, c.href)} className="rounded transition-colors hover:text-brand-dark">{c.label}</Link>
                <span aria-hidden="true" className="text-muted/60">/</span>
              </li>
            ))}
            <li aria-current="page" className="text-ink">{title}</li>
          </ol>
        </nav>
        {eyebrow && <p className="mt-6 font-script text-3xl text-brand sm:text-4xl">{eyebrow}</p>}
        <h1 className={`${eyebrow ? "mt-1" : "mt-3"} text-4xl font-bold sm:text-5xl`}>{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{intro}</p>}
        {children}
      </div>
    </section>
  );
}
