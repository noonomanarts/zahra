"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";

/** Image grid that opens a full-screen viewer (arrow keys, swipe, Esc). */
export default function Showcase({ images }: { images: string[] }) {
  const { lang } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const touch = useRef<number | null>(null);
  const labels =
    lang === "ar"
      ? { open: (n: number) => `عرض الصورة ${n}`, close: "إغلاق", prev: "السابقة", next: "التالية" }
      : { open: (n: number) => `View image ${n}`, close: "Close", prev: "Previous", next: "Next" };

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (index !== null && !d.open) d.showModal();
    if (index === null && d.open) d.close();
  }, [index]);

  const step = (dir: number) => setIndex((i) => (i === null ? i : (i + dir + images.length) % images.length));
  // "next" follows the reading direction: in Arabic it is on the left
  const rtl = lang === "ar";

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {images.map((src, i) => (
          <li key={src} className={i === 0 && images.length >= 5 ? "col-span-2 row-span-2" : ""}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={labels.open(i + 1)}
              className="group relative block aspect-square w-full overflow-hidden rounded-2xl bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-dark"
            >
              <Image src={src} alt="" fill sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"} className="object-cover transition-transform duration-500 group-hover:scale-105" />
              <span aria-hidden="true" className="absolute inset-0 bg-ink/0 transition-colors group-hover:bg-ink/10" />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        onClose={() => setIndex(null)}
        onClick={(e) => e.target === e.currentTarget && setIndex(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(rtl ? -1 : 1);
          if (e.key === "ArrowLeft") step(rtl ? 1 : -1);
        }}
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 50) step((dx < 0) !== rtl ? 1 : -1);
          touch.current = null;
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-ink/90"
      >
        {index !== null && (
          <div className="relative flex h-full w-full items-center justify-center p-4 sm:p-14" onClick={(e) => e.target === e.currentTarget && setIndex(null)}>
            <div className="pointer-events-none relative h-full w-full">
              <Image src={images[index]} alt="" fill sizes="100vw" className="object-contain" />
            </div>
            <button type="button" onClick={() => setIndex(null)} aria-label={labels.close} autoFocus className="absolute end-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-ink shadow-lg transition hover:bg-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => step(-1)} aria-label={labels.prev} className="absolute start-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl text-ink shadow-lg transition hover:bg-white">
                  <span className="rtl:rotate-180" aria-hidden="true">‹</span>
                </button>
                <button type="button" onClick={() => step(1)} aria-label={labels.next} className="absolute end-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-2xl text-ink shadow-lg transition hover:bg-white">
                  <span className="rtl:rotate-180" aria-hidden="true">›</span>
                </button>
                <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-sm text-ink" dir="ltr" aria-live="polite">
                  {index + 1} / {images.length}
                </p>
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
