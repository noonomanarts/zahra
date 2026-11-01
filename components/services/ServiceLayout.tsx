import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizeHref, type Locale } from "@/lib/i18n/config";
import { whatsappUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/shop/Collections";

type Crumb = { label: string; href: string };

/** Top of a service page: breadcrumb, title and pitch on one side, the three steps on the other. */
export function ServiceHero({
  lang,
  crumbs,
  eyebrow,
  title,
  lead,
  cta,
  steps,
  whatsapp,
}: {
  lang: Locale;
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  lead: string;
  cta: string;
  steps: { title: string; text: string }[];
  whatsapp: string;
}) {
  const t = getDictionary(lang);
  const chat = whatsappUrl(whatsapp, `${t.whatsapp.hello}${title}`);
  return (
    <section className="relative overflow-hidden bg-brand-soft">
      <svg className="pointer-events-none absolute -end-24 -top-24 h-96 w-96 text-brand/15" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="100" cy="100" r="80" strokeDasharray="8 6" />
        <circle cx="100" cy="100" r="60" strokeDasharray="4 8" />
      </svg>
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div>
          <nav aria-label={t.nav.breadcrumb}>
            <ol className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {[{ label: t.nav.home, href: "/" }, ...crumbs].map((c) => (
                <li key={c.href} className="flex items-center gap-2">
                  <Link href={localizeHref(lang, c.href)} className="hover:text-brand-dark">{c.label}</Link>
                  <span aria-hidden="true" className="text-muted/60">/</span>
                </li>
              ))}
              <li aria-current="page" className="text-ink">{title}</li>
            </ol>
          </nav>
          <p className="mt-6 font-script text-3xl text-brand sm:text-4xl">{eyebrow}</p>
          <h1 className="mt-1 text-4xl font-bold sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{lead}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#request" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-dark px-7 text-white transition-colors hover:bg-ink">
              {cta}
              <span aria-hidden="true">↓</span>
            </a>
            {chat && (
              <a href={chat} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-whatsapp/30 bg-white px-6 text-whatsapp transition-colors hover:bg-whatsapp hover:text-white">
                <WhatsAppIcon size={18} /> {t.whatsapp.short}
              </a>
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white/85 p-6 shadow-sm ring-1 ring-brand/10 backdrop-blur sm:p-8">
          <h2 className="mb-5 font-sans text-sm font-semibold tracking-wide text-brand-dark uppercase rtl:tracking-normal">{t.services.howItWorks}</h2>
          <ol>
            {steps.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
                {i < steps.length - 1 && <span aria-hidden="true" className="absolute start-[19px] top-11 bottom-1 border-s-2 border-dashed border-brand/30" />}
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand-dark ring-4 ring-white" aria-hidden="true">{i + 1}</span>
                <div className="pt-1.5">
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** The form area of a service page. */
export function ServiceForm({ title, text, children, wide }: { title: string; text?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section id="request" className={`mx-auto scroll-mt-32 px-4 pt-16 sm:px-6 sm:pt-20 ${wide ? "max-w-7xl" : "max-w-4xl"}`}>
      <div className="mb-8 max-w-2xl">
        <h2 className="text-3xl font-bold sm:text-4xl">{title}</h2>
        {text && <p className="mt-3 text-muted">{text}</p>}
      </div>
      <div className="rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-10">{children}</div>
    </section>
  );
}

/** Numbered terms & conditions at the bottom of a service page (linked from the form checkbox). */
export function ServiceTerms({ lang, items }: { lang: Locale; items: string[] }) {
  const t = getDictionary(lang);
  return (
    <section id="terms" className="mx-auto max-w-4xl scroll-mt-32 px-4 pt-16 sm:px-6 sm:pt-20">
      <div className="rounded-3xl bg-brand-soft/50 p-6 sm:p-10">
        <h2 className="text-3xl font-bold">{t.services.termsTitle}</h2>
        <ol className="mt-6 space-y-4">
          {items.map((item, i) => (
            <li key={i} className="flex gap-4 leading-relaxed">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-brand-dark shadow-sm" aria-hidden="true">{i + 1}</span>
              <span className="pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
