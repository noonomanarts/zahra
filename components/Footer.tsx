import Link from "next/link";
import Image from "next/image";
import { SbcCredit } from "@/app/SiteDocument";
import type { SiteSettings } from "@/db/schema";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizeHref, pick, type Locale } from "@/lib/i18n/config";
import { fixWhatsappLinks, whatsappDigits } from "@/lib/whatsapp";

export default function Footer({ lang, site }: { lang: Locale; site: SiteSettings }) {
  const t = getDictionary(lang);
  const year = new Date().getFullYear();
  const whatsapp = whatsappDigits(site);
  return (
    <footer className="mt-24 bg-footer text-footer-text">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {site.logo && <Image src={site.logo} alt={site.name} width={146} height={56} className="h-12 w-auto" />}
          <p className="mt-4 max-w-sm">{pick(site.tagline, lang)}</p>
          <ul className="mt-6 space-y-2 text-sm">
            {whatsapp && (
              <li>
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                  <span className="font-medium text-white">{t.whatsapp.short}:</span> <bdi dir="ltr">+{whatsapp}</bdi>
                </a>
              </li>
            )}
            {site.contact.emails.map((e) => (
              <li key={e}>
                <a href={`mailto:${e}`} className="transition-colors hover:text-white">{e}</a>
              </li>
            ))}
            {site.contact.phones.filter((p) => p.replace(/\D/g, "") !== whatsapp).map((p) => (
              <li key={p}>
                <a href={`tel:+${p.replace(/^\+/, "")}`} className="transition-colors hover:text-white" dir="ltr">+{p.replace(/^\+/, "")}</a>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            {site.social.map((s) => (
              <a
                key={s.href}
                href={fixWhatsappLinks(s.href, whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-white transition-colors hover:bg-white hover:text-footer"
              >
                {t.social[s.network] ?? s.network}
              </a>
            ))}
          </div>
        </div>

        {site.footerMenus.map((menu) => (
          <div key={menu.title.en}>
            <h3 className="text-lg font-bold text-white">{pick(menu.title, lang)}</h3>
            <ul className="mt-4 space-y-2.5">
              {menu.items.map((item) => (
                <li key={item.href}>
                  <Link href={localizeHref(lang, item.href)} className="transition-colors hover:text-white">
                    {pick(item.label, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/15 py-6 text-center text-sm">
        {t.footer.rights(year, site.name)}
        <SbcCredit lang={lang} className="mt-2" inverted />
      </div>
    </footer>
  );
}
