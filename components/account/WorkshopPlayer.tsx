"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";

/** Private/unlisted YouTube videos of a workshop with a lesson list. */
export default function WorkshopPlayer({ videos }: { videos: { id: string; title: string }[] }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(0);
  const [started, setStarted] = useState(false);
  const video = videos[current];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="relative aspect-video overflow-hidden rounded-3xl bg-ink shadow-lg">
        <iframe
          key={video.id}
          src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0&modestbranding=1${started ? "&autoplay=1" : ""}`}
          title={video.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full"
        />
      </div>

      <div className="h-fit rounded-3xl border border-line bg-white p-3">
        <p className="px-3 pt-2 pb-3 text-sm font-semibold">
          {t.account.lessons} <span className="font-normal text-muted">({videos.length})</span>
        </p>
        <ol className="max-h-[420px] space-y-1 overflow-y-auto">
          {videos.map((v, i) => {
            const active = i === current;
            return (
              <li key={v.id + i}>
                <button
                  type="button"
                  onClick={() => {
                    setCurrent(i);
                    setStarted(true);
                  }}
                  aria-current={active ? "true" : undefined}
                  className={`flex w-full items-start gap-3 rounded-2xl p-3 text-start text-sm transition ${active ? "bg-brand-soft text-brand-dark" : "hover:bg-brand-soft/50"}`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${active ? "bg-brand-dark text-white" : "bg-brand-soft text-brand-dark"}`}>
                    {active ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" className="ms-0.5" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="min-w-0 flex-1 pt-1 leading-snug">
                    {v.title}
                    {active && <span className="sr-only"> – {t.account.nowPlaying}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
