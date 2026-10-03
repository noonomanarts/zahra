import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizeHref, type Locale } from "@/lib/i18n/config";

export default function PageHeader({
  title,
  lang,
  crumbs = [],
  children,
}: {
  title: string;
  lang: Locale;
  crumbs?: { label: string; href: string }[];
  children?: React.ReactNode;
}) {
  const t = getDictionary(lang);
  return (
    <section className="bg-brand-soft">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <nav className="flex flex-wrap gap-2 text-sm text-muted" aria-label={t.nav.breadcrumb}>
          {[{ label: t.nav.home, href: "/" }, ...crumbs].map((c) => (
            <span key={c.href} className="after:ms-2 after:content-['/']">
              <Link href={localizeHref(lang, c.href)} className="hover:text-brand-dark">{c.label}</Link>
            </span>
          ))}
          <span className="text-ink">{title}</span>
        </nav>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{title}</h1>
        {children}
      </div>
    </section>
  );
}
