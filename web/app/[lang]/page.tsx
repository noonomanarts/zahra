import { notFound } from "next/navigation";
import Blocks from "@/components/Blocks";
import Hero from "@/components/Hero";
import { getPage } from "@/lib/data";
import { isLocale } from "@/lib/i18n/config";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const home = await getPage("home", lang);
  const blocks = home?.blocks ?? [];
  // the hero spans the full width; everything after it sits in the page container
  const [first, ...rest] = blocks;
  const hero = first?.type === "hero" ? first : null;

  return (
    <>
      {hero && <Hero hero={hero} lang={lang} />}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Blocks blocks={hero ? rest : blocks} lang={lang} />
      </div>
    </>
  );
}
