"use client";

import { useState } from "react";
import { useI18n } from "./providers/I18nProvider";

/**
 * Click-to-load YouTube player: nothing is requested from YouTube until the visitor presses play,
 * so the page itself depends only on this site.
 */
export default function VideoEmbed({ id }: { id: string }) {
  const [playing, setPlaying] = useState(false);
  const { lang } = useI18n();
  const label = lang === "ar" ? "تشغيل الفيديو" : "Play video";

  if (playing) {
    return (
      <div className="relative mt-8 aspect-video overflow-hidden rounded-3xl bg-ink">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={label}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={label}
      className="group relative mt-8 grid aspect-video w-full place-items-center overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-dark"
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-40" viewBox="0 0 800 450" preserveAspectRatio="none" aria-hidden="true">
        <path className="zds-stitch" d="M-20 380 C 160 260, 300 420, 460 300 S 700 80, 820 140" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      <span className="relative grid h-20 w-20 place-items-center rounded-full bg-white/95 shadow-2xl transition group-hover:scale-110">
        <svg width="28" height="28" viewBox="0 0 24 24" className="ms-1 text-brand-dark" aria-hidden="true">
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
      </span>
      <span className="absolute bottom-5 text-sm font-medium text-white/90">{label}</span>
    </button>
  );
}
