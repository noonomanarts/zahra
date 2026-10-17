"use client";

import Image from "next/image";
import { useState } from "react";
import { useI18n } from "./providers/I18nProvider";

export default function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const { t } = useI18n();
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-brand-soft">
        {images[active] && (
          <Image src={images[active]} alt={alt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-4 grid grid-cols-5 gap-3">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              aria-label={t.product.showImage(i + 1)}
              className={`relative aspect-square overflow-hidden rounded-xl border-2 transition ${
                i === active ? "border-brand" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Image src={src} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
