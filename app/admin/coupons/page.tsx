import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, isNotNull, sum } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { countsAsUse } from "@/lib/coupons";
import { formatMoney } from "@/lib/currency";
import { muscatDay } from "@/lib/finance";
import { getAdminT } from "@/lib/i18n/admin-server";
import { can } from "@/lib/permissions";
import { Badge, Card, PageTitle, btnSecondaryCls } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { ConfirmAction } from "@/components/admin/motion";
import { deleteCoupon } from "./actions";
import CouponForm from "./CouponForm";

export const metadata: Metadata = { title: "Coupons" };

export default async function CouponsPage({ searchParams }: PageProps<"/admin/coupons">) {
  const admin = await requireAdmin("coupons.view");
  const editable = can(admin.permissions, "coupons.manage");
  const { lang, t } = await getAdminT();
  const c = t.coupons;
  const { edit } = (await searchParams) as { edit?: string };
  const o = schema.orders;
  const [coupons, usage] = await Promise.all([
    db.select().from(schema.coupons).orderBy(desc(schema.coupons.createdAt)),
    db.select({ code: o.couponCode, n: count(), discount: sum(o.discount) }).from(o).where(and(isNotNull(o.couponCode), countsAsUse())).groupBy(o.couponCode),
  ]);
  const used = new Map(usage.map((u) => [u.code, u]));
  const today = muscatDay(new Date());
  const editing = coupons.find((x) => x.id === Number(edit));
  const value = (x: (typeof coupons)[number]) => (x.type === "percent" ? `${x.value}%` : formatMoney(x.value, "OMR", lang));
  const stateOf = (x: (typeof coupons)[number]) => {
    const n = used.get(x.code)?.n ?? 0;
    if (!x.active) return { status: "draft", label: c.states.off };
    if (x.endsOn && today > x.endsOn) return { status: "cancelled", label: c.states.expired };
    if (x.startsOn && today < x.startsOn) return { status: "processing", label: c.states.scheduled };
    if (x.maxUses !== null && n >= x.maxUses) return { status: "warning", label: c.states.usedUp };
    return { status: "paid", label: c.states.live };
  };

  return (
    <>
      <PageTitle title={c.title} description={c.subtitle} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,16,16,0.04)]">
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/70 text-xs font-medium tracking-wide text-zinc-500 uppercase rtl:tracking-normal">
                <tr>
                  <th className="px-4 py-3 text-start">{c.code}</th>
                  <th className="px-4 py-3 text-start">{c.value}</th>
                  <th className="px-4 py-3 text-start">{c.used}</th>
                  <th className="px-4 py-3 text-end">{c.given}</th>
                  <th className="px-4 py-3 text-start">{c.status}</th>
                  <th className="px-4 py-3"><span className="sr-only">{t.common.update}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {coupons.map((x) => {
                  const usage = used.get(x.code);
                  const state = stateOf(x);
                  return (
                    <tr key={x.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3 font-mono font-semibold" dir="ltr">{x.code}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><bdi>{value(x)}</bdi>{x.minSubtotal !== null && <span className="block text-xs text-zinc-500">{c.minShort(formatMoney(x.minSubtotal, "OMR", lang))}</span>}</td>
                      <td className="px-4 py-3 tabular-nums">{usage?.n ?? 0}{x.maxUses !== null && <span className="text-zinc-400"> / {x.maxUses}</span>}</td>
                      <td className="px-4 py-3 text-end whitespace-nowrap"><bdi>{formatMoney(Number(usage?.discount ?? 0), "OMR", lang)}</bdi></td>
                      <td className="px-4 py-3"><Badge status={state.status} label={state.label} />{x.endsOn && <span className="mt-1 block text-xs text-zinc-500" dir="ltr">{x.endsOn}</span>}</td>
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        {editable && (
                          <span className="inline-flex items-center gap-1">
                            <Link href={`/admin/coupons?edit=${x.id}`} className={`${btnSecondaryCls} px-3 py-1.5 text-xs`}>{t.common.update}</Link>
                            <form id={`delete-coupon-${x.id}`} action={deleteCoupon}><input type="hidden" name="id" value={x.id} /></form>
                            <ConfirmAction form={`delete-coupon-${x.id}`} className="grid size-8 place-items-center rounded-lg text-red-700 transition hover:bg-red-50" trigger={<Icon name="trash" size={16} />} title={c.deleteTitle} description={c.deleteText(x.code)} confirm={t.common.delete} cancel={t.common.cancel} />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!coupons.length && <p className="p-10 text-center text-sm text-zinc-500">{c.none}</p>}
        </div>
        {editable && (
          <Card title={editing ? c.editTitle(editing.code) : c.newTitle} actions={editing ? <Link href="/admin/coupons" className="text-sm text-zinc-500 hover:text-zinc-900">{t.common.cancel}</Link> : undefined}>
            <CouponForm key={editing ? `${editing.id}-${editing.type}` : "new"} coupon={editing ?? undefined} />
          </Card>
        )}
      </div>
    </>
  );
}
