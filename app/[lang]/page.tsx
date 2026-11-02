import { notFound } from "next/navigation";
import Blocks from "@/components/Blocks";
import Hero from "@/components/Hero";
import JsonLd from "@/components/JsonLd";
import { getPage, getSite } from "@/lib/data";
import { absoluteUrl } from "@/lib/seo";
import { isLocale } from "@/lib/i18n/config";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [home, site] = await Promise.all([getPage("home", lang), getSite()]);
  const blocks = home?.blocks ?? [];
  // the hero spans the full width; everything after it sits in the page container
  const [first, ...rest] = blocks;
  const hero = first?.type === "hero" ? first : null;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Store",
          name: site.name,
          url: absoluteUrl(`/${lang}`),
          logo: site.logo ? absoluteUrl(site.logo) : undefined,
          email: site.contact.emails[0],
          telephone: site.contact.phones[0],
          sameAs: site.social.map((s) => s.href).filter((href) => href.startsWith("http")),
        }}
      />
      {hero && <Hero hero={hero} lang={lang} />}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Blocks blocks={hero ? rest : blocks} lang={lang} />
      </div>
    </>
  );
}
