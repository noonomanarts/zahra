import { getCustomer } from "@/lib/customer-auth";
import { getSite } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { pick, type Locale } from "@/lib/i18n/config";
import { getPrintService } from "@/lib/requests";
import { whatsappDigits } from "@/lib/whatsapp";
import PrintDesignForm from "./PrintDesignForm";
import { ServiceForm, ServiceHero, ServiceTerms } from "./ServiceLayout";

export default async function PrintDesignPage({ lang, crumbs }: { lang: Locale; crumbs: { label: string; href: string }[] }) {
  const p = getDictionary(lang).printDesign;
  const [site, settings, customer] = await Promise.all([getSite(), getPrintService(), getCustomer()]);
  const whatsapp = whatsappDigits(site);

  return (
    <>
      <ServiceHero lang={lang} crumbs={crumbs} eyebrow={p.eyebrow} title={p.title} lead={p.lead} cta={p.start} steps={p.steps} whatsapp={whatsapp} />
      <ServiceForm title={p.formTitle} wide>
        <PrintDesignForm
          whatsapp={whatsapp}
          fabrics={settings.fabrics.map((f) => pick(f, lang))}
          hoopSizes={settings.hoopSizes}
          fees={{ "as-is": settings.asIsFee, edits: settings.editsFee }}
          defaults={customer && { name: customer.name, email: customer.email }}
        />
      </ServiceForm>
      <ServiceTerms lang={lang} items={p.terms} />
    </>
  );
}
