import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizeHref, type Locale } from "@/lib/i18n/config";
import { submitReview } from "@/app/[lang]/review-actions";
import ReviewForm from "./ReviewForm";

const STAR = "m12 4 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 4Z";

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5 text-amber-500" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => <svg key={n} width="16" height="16" viewBox="0 0 24 24" fill={n <= Math.round(rating) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5"><path d={STAR} /></svg>)}
    </span>
  );
}

type Data = { reviews: { id: number; rating: number; body: string; createdAt: Date; author: string }[]; count: number; average: number };

export default function ProductReviews({ lang, productId, data, signedIn, mayReview, own }: { lang: Locale; productId: number; data: Data; signedIn: boolean; mayReview: boolean; own: { rating: number; body: string; status: string } | null }) {
  const r = getDictionary(lang).reviews;
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Muscat" });
  if (!data.count && !mayReview) return null;
  return (
    <section id="reviews" className="mx-auto mb-16 max-w-7xl scroll-mt-32 px-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-3xl font-bold">{r.title}</h2>
        {data.count > 0 && <p className="flex items-center gap-2 text-sm text-muted"><Stars rating={data.average} /> {r.summary(data.average, data.count)}</p>}
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div>
          {data.count > 0 ? (
            <ul className="divide-y divide-line">
              {data.reviews.map((x) => (
                <li key={x.id} className="py-5 first:pt-0">
                  <div className="flex flex-wrap items-center gap-3 text-sm"><Stars rating={x.rating} /><span className="sr-only">{r.starsLabel(x.rating)}</span><strong dir="auto">{x.author}</strong><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">{r.verified}</span><span className="text-muted">{dateFmt.format(x.createdAt)}</span></div>
                  <p className="mt-2 leading-relaxed whitespace-pre-line" dir="auto">{x.body}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted">{r.none}</p>}
        </div>
        <div className="space-y-3">
          {own?.status === "pending" && <p role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{r.ownPending}</p>}
          {mayReview ? <ReviewForm action={submitReview.bind(null, productId)} own={own} /> : !signedIn && <p className="text-sm text-muted"><Link href={localizeHref(lang, "/login")} className="underline underline-offset-4">{r.signInToReview}</Link></p>}
        </div>
      </div>
    </section>
  );
}
