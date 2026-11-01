import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { EmptyCollection } from "@/components/shop/Collections";
import WorkshopCard from "@/components/workshops/WorkshopCard";
import { getCustomer } from "@/lib/customer-auth";
import { getSite, listWorkshops } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import { whatsappDigits } from "@/lib/whatsapp";
import { customerWorkshops } from "@/lib/workshops";

export async function generateMetadata({ params }: PageProps<"/[lang]/workshops">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).workshops;
  return { title: t.title, description: t.lead, alternates: { languages: { en: "/en/workshops", ar: "/ar/workshops" } } };
}

export default async function WorkshopsPage({ params }: PageProps<"/[lang]/workshops">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang).workshops;
  const [workshops, site, customer] = await Promise.all([listWorkshops(lang), getSite(), getCustomer()]);
  const owned = new Set(customer ? (await customerWorkshops(customer.id, lang)).map((w) => w.id) : []);

  return (
    <>
      <PageHeader title={t.title} lang={lang} eyebrow={t.eyebrow} intro={t.lead}>
        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {t.steps.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-2xl bg-white/70 p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-dark text-sm font-semibold text-white" aria-hidden="true">{i + 1}</span>
              <span>
                <span className="block font-semibold">{s.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </PageHeader>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {workshops.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {workshops.map((w) => <WorkshopCard key={w.slug} product={w} lang={lang} owned={owned.has(w.id)} />)}
          </div>
        ) : (
          <EmptyCollection lang={lang} whatsapp={whatsappDigits(site)} title={t.title} text={{ title: t.empty, body: t.emptyText }} />
        )}
      </div>
    </>
  );
}
