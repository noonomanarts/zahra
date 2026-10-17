import Image from "next/image";
import { localizeHref, pick, type Locale } from "@/lib/i18n/config";
import type { Block } from "@/lib/types";
import RichText from "./RichText";
import Button from "./Button";
import { HERO_ART, HERO_STITCHES } from "./hero-stitches";

type HeroBlock = Extract<Block, { type: "hero" }>;

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

/**
 * The original composition (photo collage + dashed thread) stays still; for the default artwork the
 * dashed thread is drawn as SVG on top of a dash-free copy of the image, so only the stitches move.
 * Image and SVG share the same box and the same "contain, anchored to the end" scaling, so they line up.
 */
function HeroArt({ src }: { src: string }) {
  const animated = src === HERO_ART.src;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-12 inset-x-6 hidden lg:block rtl:-scale-x-100">
      <Image src={src} alt="" fill priority sizes="(min-width: 1280px) 1000px, 80vw" className="object-contain object-right" />
      {animated && (
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${HERO_ART.width} ${HERO_ART.height}`} preserveAspectRatio="xMaxYMid meet" fill="none">
          {HERO_STITCHES.map((s) => (
            <path
              key={s.d.slice(0, 24)}
              d={s.d}
              className="zds-flow"
              stroke={s.over ? "#f2d4ca" : "#f6d5cf"}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeDasharray={`${HERO_ART.dash} ${HERO_ART.gap}`}
              style={{ "--o": `${s.offset}px`, strokeDashoffset: `${s.offset}px` } as React.CSSProperties}
            />
          ))}
        </svg>
      )}
    </div>
  );
}

export default function Hero({ hero, lang }: { hero: HeroBlock; lang: Locale }) {
  const subtitle = pick(hero.subtitle, lang);

  return (
    <section className="relative overflow-hidden bg-white">
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:flex lg:min-h-[720px] lg:items-center lg:py-12">
        {hero.background && <HeroArt src={hero.background} />}

        <div className="relative mx-auto max-w-xl text-center lg:mx-0 lg:w-1/2 lg:max-w-none lg:px-6">
          <h1 className="zds-rise font-script text-6xl leading-tight font-normal text-ink sm:text-7xl lg:whitespace-nowrap xl:text-[5.5rem] rtl:leading-normal">
            {pick(hero.title, lang)}
          </h1>
          {subtitle && (
            <p className="zds-rise mt-4 text-2xl font-light tracking-[0.12em] text-ink uppercase sm:text-3xl rtl:font-normal rtl:tracking-normal" style={delay(150)}>
              {subtitle}
            </p>
          )}
          <div className="zds-rise" style={delay(300)}>
            <RichText text={hero.html} lang={lang} className="mx-auto mt-8 max-w-md text-[15px] leading-7 tracking-wide [&_p]:my-0 rtl:leading-8 rtl:tracking-normal" />
          </div>
          {hero.button && (
            <div className="zds-rise mt-8" style={delay(450)}>
              <Button
                href={localizeHref(lang, hero.button.href)}
                className="group relative overflow-hidden px-20 py-3.5 text-sm tracking-wider uppercase shadow-lg shadow-brand/30 transition hover:-translate-y-0.5 hover:shadow-xl rtl:tracking-normal"
              >
                <span className="absolute inset-y-0 -start-1/2 w-1/3 -skew-x-12 bg-white/25 transition-all duration-700 group-hover:start-[120%]" aria-hidden="true" />
                <span className="relative">{pick(hero.button.text, lang)}</span>
              </Button>
            </div>
          )}
        </div>

        {/* small screens: the collage under the text */}
        {(hero.image || hero.background) && (
          <Image
            src={(hero.image || hero.background)!}
            alt=""
            width={703}
            height={760}
            priority
            sizes="100vw"
            className="mx-auto mt-12 h-auto w-full max-w-md lg:hidden"
          />
        )}
      </div>
    </section>
  );
}
