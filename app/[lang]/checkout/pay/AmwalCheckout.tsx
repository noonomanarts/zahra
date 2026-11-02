"use client";

import Link from "next/link";
import Script from "next/script";
import { useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";

type SmartBoxWindow = Window & { SmartBox?: { Checkout: { configure: unknown; showSmartBox: () => void } } };
type Completed = { data?: { responseCode?: unknown; data?: Record<string, unknown> } };

/** Opens AmwalPay's payment window; its result comes back to the signed result page. */
export default function AmwalCheckout({ script, payload, resultUrl }: { script: string; payload: Record<string, unknown>; resultUrl: string }) {
  const { t, href } = useI18n();
  const c = t.checkout;
  const [state, setState] = useState<"loading" | "open" | "error" | "cancelled">("loading");

  const open = () => {
    const box = (window as SmartBoxWindow).SmartBox;
    if (!box) return setState("error");
    box.Checkout.configure = {
      ...payload,
      completeCallback: (result: Completed) => {
        const d = result.data?.data ?? {};
        const params = new URLSearchParams();
        // missing values travel as the text "null": they are signed that way
        for (const key of ["amount", "currencyId", "customerId", "customerTokenId", "merchantReference", "transactionId", "transactionTime", "secureHashValue"]) params.set(key, String(d[key]));
        params.set("responseCode", String(result.data?.responseCode));
        window.location.assign(`${resultUrl}?${params}`);
      },
      errorCallback: () => setState("error"),
      cancelCallback: () => setState("cancelled"),
    };
    box.Checkout.showSmartBox();
    setState("open");
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <Script src={script} onReady={open} onError={() => setState("error")} />
      <h1 className="text-3xl font-bold">{c.payTitle}</h1>
      <p role="status" className="mt-4 text-muted">{state === "error" ? c.payError : state === "cancelled" ? c.payCancelled : c.payWait}</p>
      {(state === "error" || state === "cancelled") && (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={open} className="min-h-11 rounded-full bg-brand-dark px-6 text-white transition hover:bg-ink">{c.payAgain}</button>
          <Link href={href("/checkout")} className="inline-flex min-h-11 items-center rounded-full border border-brand-dark/25 px-6 transition hover:bg-brand-soft">{c.backToCheckout}</Link>
        </div>
      )}
    </div>
  );
}
