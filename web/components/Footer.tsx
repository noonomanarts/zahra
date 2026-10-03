import Link from "next/link";
import Image from "next/image";
import type { SiteSettings } from "@/db/schema";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizeHref, pick, type Locale } from "@/lib/i18n/config";

export default function Footer({ lang, site }: { lang: Locale; site: SiteSettings }) {
  const t = getDictionary(lang);
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-brand-soft">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {site.logo && <Image src={site.logo} alt={site.name} width={146} height={56} className="h-12 w-auto" />}
          <p className="mt-4 max-w-sm text-muted">{pick(site.tagline, lang)}</p>
          <ul className="mt-6 space-y-2 text-sm">
            {site.contact.emails.map((e) => (
              <li key={e}>
                <a href={`mailto:${e}`} className="hover:text-brand-dark">{e}</a>
              </li>
            ))}
            {site.contact.phones.map((p) => (
              <li key={p}>
                <a href={`tel:+${p.replace(/^\+/, "")}`} className="hover:text-brand-dark" dir="ltr">+{p.replace(/^\+/, "")}</a>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            {site.social.map((s) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-brand/40 px-3.5 py-1.5 text-xs text-brand-dark transition-colors hover:bg-brand hover:text-white"
              >
                {t.social[s.network] ?? s.network}
              </a>
            ))}
          </div>
        </div>

        {site.footerMenus.map((menu) => (
          <div key={menu.title.en}>
            <h3 className="text-lg font-bold">{pick(menu.title, lang)}</h3>
            <ul className="mt-4 space-y-2.5">
              {menu.items.map((item) => (
                <li key={item.href}>
                  <Link href={localizeHref(lang, item.href)} className="text-muted transition-colors hover:text-brand-dark">
                    {pick(item.label, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-brand/15 py-6 text-center text-sm text-muted">{t.footer.rights(year, site.name)}</div>
    </footer>
  );
}
