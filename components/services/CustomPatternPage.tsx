import { getCustomer } from "@/lib/customer-auth";
import { getPageRaw, getSite } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { whatsappDigits } from "@/lib/whatsapp";
import CustomPatternForm from "./CustomPatternForm";
import { ServiceForm, ServiceHero, ServiceTerms } from "./ServiceLayout";
import Showcase from "./Showcase";

/** Showcase images come from the "customized-pattern" page in Admin → Pages (gallery blocks). */
export const CUSTOM_PATTERN_PAGE = "customized-pattern";

export default async function CustomPatternPage({ lang, crumbs }: { lang: Locale; crumbs: { label: string; href: string }[] }) {
  const t = getDictionary(lang);
  const c = t.customPattern;
  const [site, page, customer] = await Promise.all([getSite(), getPageRaw(CUSTOM_PATTERN_PAGE), getCustomer()]);
  const whatsapp = whatsappDigits(site);
  const images = (page?.blocks ?? []).flatMap((b) => (b.type === "gallery" ? b.images : b.type === "image" && b.src ? [b.src] : []));

  return (
    <>
      <ServiceHero lang={lang} crumbs={crumbs} eyebrow={c.eyebrow} title={c.title} lead={c.lead} cta={c.start} steps={c.steps} whatsapp={whatsapp} />

      {images.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 sm:pt-20" aria-labelledby="showcase-title">
          <div className="mb-8 max-w-2xl">
            <h2 id="showcase-title" className="text-3xl font-bold sm:text-4xl">{c.galleryTitle}</h2>
            <p className="mt-3 text-muted">{c.galleryText}</p>
          </div>
          <Showcase images={images} />
        </section>
      )}

      <ServiceForm title={c.formTitle} text={c.formText}>
        <CustomPatternForm whatsapp={whatsapp} defaults={customer && { name: customer.name, email: customer.email }} />
      </ServiceForm>

      <ServiceTerms lang={lang} items={c.terms} />
    </>
  );
}
