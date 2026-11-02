import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/currency";
import { FINANCE_CATEGORIES, PERIODS, financeReport, muscatDay, periodRange, type Period } from "@/lib/finance";
import { getAdminT } from "@/lib/i18n/admin-server";
import { Card, Notice, PageTitle, Stat, btnCls, btnSecondaryCls, inputCls, ReadOnly } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import EntryForm from "./EntryForm";
import { Count, SlidingTabs } from "@/components/admin/motion";
import { deleteEntry } from "./actions";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: PageProps<"/admin/finance">) {
  const admin = await requireAdmin("finance.view");
  const editable = can(admin.permissions, "finance.manage");
  const { lang, t } = await getAdminT();
  const f = t.finance;
  const q = (await searchParams) as { p?: string; from?: string; to?: string };
  const period: Period = (PERIODS as readonly string[]).includes(q.p ?? "") ? (q.p as Period) : "month";
  const report = await financeReport(periodRange(period, q.from, q.to));
  const { totals, monthly } = report;
  // `|| 0` turns −0 into 0, so empty costs never show as "-0.000"
  const money = (v: number) => <bdi>{formatMoney(v || 0, "OMR", lang)}</bdi>;
  const query = new URLSearchParams({ p: period, ...(period === "custom" ? { from: report.range.from, to: report.range.to } : {}) });
  const margin = totals.revenue > 0 ? `${Math.round((totals.profit / totals.revenue) * 100)}%` : null;
  const monthName = (key: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
  const peak = Math.max(1, ...monthly.flatMap((m) => [m.revenue, m.costs + m.expenses]));

  const kpis = [
    { label: f.revenue, value: totals.revenue, hint: f.revenueHint(totals.orders), tone: "sky" as const, icon: "wallet" as const },
    { label: f.costs, value: totals.costs, hint: f.costsHint, tone: "amber" as const, icon: "box" as const },
    { label: f.expenses, value: totals.expenses, hint: f.expensesHint, tone: "rose" as const, icon: "currencies" as const },
    { label: f.profit, value: totals.profit, hint: margin ? f.margin(margin) : "—", tone: "emerald" as const, icon: "finance" as const },
  ];

  return (
    <>
      <PageTitle title={f.title} description={f.intro} actions={<a href={`/admin/finance/export?${query}`} className={btnSecondaryCls}>{f.exportCsv}</a>} />

      <form className="mb-6 flex flex-wrap items-end gap-2">
        <SlidingTabs
          ariaLabel={f.period}
          value={period}
          items={PERIODS.filter((p) => p !== "custom").map((p) => ({ value: p, label: f.periods[p], href: `/admin/finance?p=${p}` }))}
        />
        <input type="hidden" name="p" value="custom" />
        <label className="ms-auto text-xs text-zinc-500">{f.from}<input name="from" type="date" dir="ltr" defaultValue={report.range.from > "2000-01-01" ? report.range.from : ""} className={`${inputCls} mt-1`} /></label>
        <label className="text-xs text-zinc-500">{f.to}<input name="to" type="date" dir="ltr" defaultValue={report.range.to} className={`${inputCls} mt-1`} /></label>
        <button className={`${period === "custom" ? btnCls : btnSecondaryCls}`}>{f.apply}</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Stat
            key={k.label}
            label={k.label}
            hint={k.hint}
            tone={k.tone}
            icon={<Icon name={k.icon} />}
            value={<span className={k.value < 0 ? "text-red-700" : ""}><Count value={k.value} decimals={3} prefix={lang === "ar" ? undefined : "OMR "} suffix={lang === "ar" ? " ر.ع." : undefined} /></span>}
          />
        ))}
      </div>

      {report.missingCosts > 0 && (
        <div className="mt-4">
          <Notice action={<Link href="/admin/products" className={btnSecondaryCls}>{f.setCosts}</Link>}>{f.missingCost(report.missingCosts)}</Notice>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card title={f.monthly}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="py-2 text-start font-medium">{f.month}</th>
                  <th className="py-2 text-start font-medium" aria-hidden="true" />
                  <th className="py-2 text-end font-medium">{f.revenue}</th>
                  <th className="py-2 text-end font-medium">{f.costs} + {f.expenses}</th>
                  <th className="py-2 text-end font-medium">{f.profit}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {monthly.map((m) => (
                  <tr key={m.month}>
                    <td className="py-2 pe-3 whitespace-nowrap text-zinc-600">{monthName(m.month)}</td>
                    <td className="w-1/3 py-2 pe-3" aria-hidden="true">
                      <div className="space-y-1">
                        <div className="h-2 rounded-full bg-emerald-500/80" style={{ width: `${(m.revenue / peak) * 100}%` }} />
                        <div className="h-2 rounded-full bg-rose-400/80" style={{ width: `${((m.costs + m.expenses) / peak) * 100}%` }} />
                      </div>
                    </td>
                    <td className="py-2 text-end whitespace-nowrap">{money(m.revenue)}</td>
                    <td className="py-2 text-end whitespace-nowrap text-zinc-600">{money(m.costs + m.expenses)}</td>
                    <td className={`py-2 text-end font-medium whitespace-nowrap ${m.profit < 0 ? "text-red-700" : ""}`}>{money(m.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title={f.breakdown}>
            <dl className="space-y-2 text-sm">
              {[
                [f.productSales, totals.productSales, ""],
                [f.shippingCharged, totals.shipping, ""],
                [f.revenue, totals.revenue, "font-semibold border-t border-zinc-100 pt-2"],
                [f.cogs, -totals.cogs, "text-zinc-600"],
                [f.purchases, -totals.purchases, "text-zinc-600"],
                [f.expenses, -totals.expenses, "text-zinc-600"],
                [f.profit, totals.profit, `font-semibold border-t border-zinc-200 pt-2 ${totals.profit < 0 ? "text-red-700" : "text-emerald-700"}`],
              ].map(([label, value, cls]) => (
                <div key={label as string} className={`flex justify-between gap-4 ${cls}`}>
                  <dt>{label}</dt>
                  <dd>{money(value as number)}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title={f.topProducts}>
            {report.topProducts.length ? (
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr><th className="pb-2 text-start font-medium">{t.products.product}</th><th className="pb-2 text-end font-medium">{f.sold}</th><th className="pb-2 text-end font-medium">{f.profitShort}</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {report.topProducts.map((p) => (
                    <tr key={p.name}>
                      <td className="py-2 pe-2">{p.productId ? <Link href={`/admin/products/${p.productId}`} className="hover:underline">{p.name}</Link> : p.name}</td>
                      <td className="py-2 text-end">{p.quantity}</td>
                      <td className="py-2 text-end whitespace-nowrap">{money(p.sales - p.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-zinc-500">{f.noData}</p>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <Card title={f.entries}>
          <h3 className="mb-3 font-sans text-sm font-semibold">{f.addEntry}</h3>
          <ReadOnly when={!editable} label={t.common.readOnly}><EntryForm today={muscatDay(new Date())} categories={FINANCE_CATEGORIES} /></ReadOnly>
          <div className="mt-6 overflow-x-auto">
            {report.entries.length ? (
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 text-xs text-zinc-500">
                  <tr>
                    <th className="py-2 text-start font-medium">{f.date}</th>
                    <th className="py-2 text-start font-medium">{f.kind}</th>
                    <th className="py-2 text-start font-medium">{f.category}</th>
                    <th className="py-2 text-start font-medium">{f.description}</th>
                    <th className="py-2 text-end font-medium">{f.amount}</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {report.entries.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 whitespace-nowrap text-zinc-600" dir="ltr">{e.date}</td>
                      <td className="py-2">{e.kind === "cost" ? f.costs : f.expenses}</td>
                      <td className="py-2 text-zinc-600">{f.categories[e.category] ?? e.category}</td>
                      <td className="py-2">{e.description}</td>
                      <td className="py-2 text-end whitespace-nowrap">{money(e.amount)}</td>
                      <td className="py-2 text-end">
                        {editable && (
                          <form action={deleteEntry}>
                            <input type="hidden" name="id" value={e.id} />
                            <button className="text-xs text-red-700 hover:underline">{f.remove}</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-zinc-500">{f.noEntries}</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
