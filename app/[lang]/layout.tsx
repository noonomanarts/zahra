import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SiteDocument from "@/app/SiteDocument";
import CartProvider from "@/components/cart/CartProvider";
import CurrencyProvider from "@/components/providers/CurrencyProvider";
import PwaProvider from "@/components/pwa/PwaProvider";
import I18nProvider from "@/components/providers/I18nProvider";
import { getRates } from "@/lib/currency-server";
import { getSite } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LOCALES, dirOf, isLocale, pick } from "@/lib/i18n/config";
import { PWA } from "@/lib/pwa/config";
import { arefRuqaa, plexArabic } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  themeColor: PWA.themeColor,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const site = await getSite();
  const name = site.name;
  return {
    metadataBase: new URL(process.env.APP_URL ?? "https://zahrasdesignstudio.com"),
    title: { default: `${name} – ${pick(site.tagline, lang)}`, template: `%s | ${name}` },
    description: getDictionary(lang).meta.description,
    alternates: { languages: { en: "/en", ar: "/ar" } },
    manifest: `/${lang}/manifest.webmanifest`,
    applicationName: name,
    appleWebApp: { capable: true, title: lang === "ar" ? "زهراء ستوديو" : "Zahra's Studio", statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export default async function SiteLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [site, rates] = await Promise.all([getSite(), getRates()]);

  return (
    <SiteDocument lang={lang} dir={dirOf(lang)} className={`h-full antialiased ${plexArabic.variable} ${arefRuqaa.variable}`} siteName={site.name}>
      <body className="flex min-h-full flex-col">
        <I18nProvider lang={lang}>
          <CurrencyProvider rates={rates}>
            <CartProvider>
              <Header lang={lang} logo={site.logo} name={site.name} menu={site.mainMenu} />
              <main className="flex-1">{children}</main>
              <Footer lang={lang} site={site} />
              <PwaProvider />
            </CartProvider>
          </CurrencyProvider>
        </I18nProvider>
      </body>
    </SiteDocument>
  );
}
