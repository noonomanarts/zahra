import { isFallback, localizeHtml, pick, type Locale } from "@/lib/i18n/config";
import type { L } from "@/lib/types";

/** Rich text in the current language; English shown on the Arabic site keeps its own direction. */
export default function RichText({ text, lang, className = "" }: { text: L; lang: Locale; className?: string }) {
  return (
    <div
      className={`prose-zahra ${className}`}
      dir={isFallback(text, lang) ? "ltr" : undefined}
      dangerouslySetInnerHTML={{ __html: localizeHtml(pick(text, lang), lang) }}
    />
  );
}
