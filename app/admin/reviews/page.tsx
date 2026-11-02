import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { REVIEW_STATUSES, type ReviewStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getAdminT } from "@/lib/i18n/admin-server";
import { pick } from "@/lib/i18n/config";
import { can } from "@/lib/permissions";
import { PageTitle, btnCls, btnSecondaryCls } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { ConfirmAction, SlidingTabs } from "@/components/admin/motion";
import { deleteReview, moderateReview } from "./actions";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const admin = await requireAdmin("reviews.view");
  const editable = can(admin.permissions, "reviews.manage");
  const { lang, t } = await getAdminT();
  const v = t.reviews;
  const { status: raw } = (await searchParams) as { status?: string };
  const status: ReviewStatus = REVIEW_STATUSES.includes(raw as ReviewStatus) ? (raw as ReviewStatus) : "pending";
  const r = schema.productReviews;
  const [rows, counts] = await Promise.all([
    db.select({ id: r.id, rating: r.rating, body: r.body, createdAt: r.createdAt, customerId: r.customerId, customer: schema.customers.name, productId: schema.products.id, kind: schema.products.kind, name: schema.products.name, nameAr: schema.products.nameAr })
      .from(r)
      .innerJoin(schema.customers, eq(schema.customers.id, r.customerId))
      .innerJoin(schema.products, eq(schema.products.id, r.productId))
      .where(eq(r.status, status))
      .orderBy(desc(r.createdAt))
      .limit(200),
    db.select({ status: r.status, n: count() }).from(r).groupBy(r.status),
  ]);
  const totals = new Map(counts.map((c) => [c.status, c.n]));
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Muscat" });
  const setStatus = (id: number, next: ReviewStatus, label: string, primary?: boolean) => (
    <form action={moderateReview}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <button className={`${primary ? btnCls : btnSecondaryCls} px-3 py-1.5 text-xs`}>{label}</button>
    </form>
  );

  return (
    <>
      <PageTitle title={v.title} description={v.subtitle} />
      <div className="mb-4">
        <SlidingTabs ariaLabel={v.title} value={status} items={REVIEW_STATUSES.map((s) => ({ value: s, label: v.statuses[s], href: `/admin/reviews?status=${s}`, count: totals.get(s) }))} />
      </div>
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((x) => (
            <li key={x.id} className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,16,16,0.04)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-0.5 text-amber-500" role="img" aria-label={v.ratingLabel(x.rating)}>
                    {[1, 2, 3, 4, 5].map((n) => <svg key={n} width="15" height="15" viewBox="0 0 24 24" fill={n <= x.rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m12 4 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 4Z" /></svg>)}
                  </p>
                  <p className="mt-2 text-sm whitespace-pre-line text-zinc-800" dir="auto">{x.body}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {can(admin.permissions, "customers.view") ? <Link href={`/admin/customers/${x.customerId}`} className="hover:underline">{x.customer}</Link> : x.customer}
                    {" · "}
                    <Link href={x.kind === "workshop" ? `/admin/workshops/${x.productId}` : `/admin/products/${x.productId}`} className="hover:underline">{pick({ en: x.name, ar: x.nameAr }, lang)}</Link>
                    {" · "}{dateFmt.format(x.createdAt)}
                  </p>
                </div>
                {editable && (
                  <div className="flex flex-wrap items-center gap-2">
                    {status !== "approved" && setStatus(x.id, "approved", v.approve, true)}
                    {status !== "rejected" && setStatus(x.id, "rejected", v.reject)}
                    <form id={`delete-review-${x.id}`} action={deleteReview}><input type="hidden" name="id" value={x.id} /></form>
                    <ConfirmAction form={`delete-review-${x.id}`} className="grid size-8 place-items-center rounded-lg text-red-700 transition hover:bg-red-50" trigger={<Icon name="trash" size={16} />} title={v.deleteTitle} description={v.deleteText} confirm={t.common.delete} cancel={t.common.cancel} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-zinc-200/80 bg-white p-10 text-center text-sm text-zinc-500">{v.none}</p>
      )}
    </>
  );
}
