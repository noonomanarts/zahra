"use client";

import { useActionState } from "react";
import type { CurrencySettings } from "@/db/schema";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Card, FormMessage, btnCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { CURRENCIES, CURRENCY_INFO, formatMoney, type CurrencyCode } from "@/lib/currency";
import { approveRates, fetchRates, saveRates, type CurrencyState } from "./actions";

const EXAMPLE_OMR = 7.8;

export default function CurrencyPanel({ settings, sourceUrl }: { settings: CurrencySettings; sourceUrl: string }) {
  const { lang, t } = useAdminI18n();
  const c = t.currencies;
  const [fetchState, fetchAction, fetching] = useActionState<CurrencyState>(fetchRates, {});
  const [approveState, approveAction, approving] = useActionState<CurrencyState>(approveRates, {});
  const [saveState, saveAction, saving] = useActionState<CurrencyState, FormData>(saveRates, {});
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" });
  const when = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : c.never);
  const pending = settings.pending;

  const change = (code: CurrencyCode) => {
    const next = pending?.rates[code];
    if (!next) return null;
    const pct = ((next - settings.rates[code]) / settings.rates[code]) * 100;
    const cls = Math.abs(pct) < 0.05 ? "text-zinc-400" : pct > 0 ? "text-emerald-700" : "text-red-700";
    return <span className={cls} dir="ltr">{pct > 0 ? "+" : ""}{pct.toFixed(2)}%</span>;
  };

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-zinc-600">{c.intro}</p>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <form action={fetchAction}>
            <button disabled={fetching} className={btnSecondaryCls}>{fetching ? t.common.saving : c.fetch}</button>
          </form>
          <form action={approveAction}>
            <button disabled={!pending || approving} className={btnCls}>{c.approve}</button>
          </form>
          <dl className="ms-auto grid grid-cols-[auto_auto] gap-x-3 text-xs text-zinc-500">
            <dt>{c.lastFetched}</dt><dd>{when(pending?.fetchedAt)}</dd>
            <dt>{c.lastApproved}</dt><dd>{when(settings.approvedAt)}</dd>
            <dt>{c.source}</dt>
            <dd><a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-900">Bank Muscat ↗</a></dd>
          </dl>
        </div>
        <div className="mt-3 space-y-2">
          <FormMessage state={fetchState} />
          <FormMessage state={approveState} />
        </div>
      </Card>

      <form action={saveAction}>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-start">{c.code}</th>
                <th className="px-4 py-3 text-start">{c.live}</th>
                <th className="px-4 py-3 text-start">
                  {c.bank}
                  <span className="block font-normal normal-case">{c.buySell}</span>
                </th>
                <th className="px-4 py-3 text-start">{c.change}</th>
                <th className="px-4 py-3 text-start">{c.example}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {CURRENCIES.map((code) => {
                const quote = pending?.quotes[code];
                return (
                  <tr key={code}>
                    <td className="px-4 py-3">
                      <span className="me-2">{CURRENCY_INFO[code].flag}</span>
                      <span className="font-medium" dir="ltr">{code}</span>
                      <span className="block text-xs text-zinc-500">{CURRENCY_INFO[code][lang]}</span>
                    </td>
                    <td className="px-4 py-3">
                      {code === "OMR" ? (
                        <span className="text-zinc-500" dir="ltr">1</span>
                      ) : (
                        <input
                          name={`rate_${code}`}
                          type="number"
                          step="any"
                          min="0"
                          dir="ltr"
                          required
                          defaultValue={settings.rates[code]}
                          aria-label={`${code} ${c.live}`}
                          className={`${inputCls} w-32`}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {code === "OMR" ? (
                        "—"
                      ) : pending?.rates[code] ? (
                        <>
                          <span className="font-medium">{pending.rates[code]}</span>
                          {quote && <span className="block text-xs text-zinc-500">{quote.buy} / {quote.sell}</span>}
                        </>
                      ) : (
                        <span className="text-xs text-zinc-400">{pending && code === "IQD" ? c.notPublished : code === "IQD" ? c.notPublished : "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{change(code)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><bdi>{formatMoney(EXAMPLE_OMR * settings.rates[code], code, lang)}</bdi></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button disabled={saving} className={btnCls}>{saving ? t.common.saving : c.saveManual}</button>
          <FormMessage state={saveState} />
        </div>
      </form>
    </div>
  );
}
