"use client";

import { useActionState, useState } from "react";
import { submitReview, type ReviewState } from "@/app/[lang]/review-actions";
import { useI18n } from "@/components/providers/I18nProvider";

export default function ReviewForm({ productId, own }: { productId: number; own: { rating: number; body: string } | null }) {
  const { t } = useI18n();
  const r = t.reviews;
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview.bind(null, productId), {});
  const [rating, setRating] = useState(own?.rating ?? 0);
  if (state.saved) return <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{r.thanks}</p>;
  return (
    <form action={action} className="space-y-4 rounded-3xl border border-line p-6">
      <h3 className="text-lg font-semibold">{own ? r.editYours : r.writeOne}</h3>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{r.yourRating}</legend>
        <div className="flex gap-1 text-amber-500">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} required checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" />
              <span className="sr-only">{r.starsLabel(n)}</span>
              <svg width="28" height="28" viewBox="0 0 24 24" fill={n <= rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" className="rounded peer-focus-visible:outline-2 peer-focus-visible:outline-brand-dark" aria-hidden="true"><path d="m12 4 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 4Z" /></svg>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="review-body" className="mb-2 block text-sm font-medium">{r.yourReview}</label>
        <textarea id="review-body" name="body" required minLength={3} maxLength={1000} rows={4} dir="auto" defaultValue={own?.body} className="w-full rounded-xl border border-line bg-white px-4 py-3 outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10" />
      </div>
      {state.error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{r.errors[state.error]}</p>}
      <button disabled={pending} className="min-h-11 rounded-full bg-brand-dark px-6 text-white transition hover:bg-ink disabled:opacity-60">{pending ? r.sending : r.send}</button>
      <p className="text-xs text-muted">{r.moderated}</p>
    </form>
  );
}
