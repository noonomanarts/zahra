import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/currency";
import { getAdminT } from "@/lib/i18n/admin-server";
import { pick } from "@/lib/i18n/config";
import { adminCatalogue } from "@/lib/data";
import { skuSuggestions } from "@/lib/sku";
import { workshopRoster } from "@/lib/workshops";
import { Badge, Card, Notice, PageTitle, Stat, btnDangerCls, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { ConfirmAction, Count, SlidingTabs } from "@/components/admin/motion";
import ProductForm from "../../products/ProductForm";
import { deleteProduct } from "../../products/actions";
import { linkGuestOrder, revokeWorkshop } from "../actions";
import GrantForm from "./GrantForm";
import WorkshopContent from "./WorkshopContent";

export const metadata: Metadata = { title: "Workshop" };

export default async function WorkshopPage({ params, searchParams }: PageProps<"/admin/workshops/[id]">) {
  await requireAdmin();
  const { lang, t } = await getAdminT();
  const w = t.workshops;
  const id = Number((await params).id);
  const { tab: rawTab, q = "", created } = (await searchParams) as { tab?: string; q?: string; created?: string };
  const tab = rawTab === "students" || rawTab === "details" ? rawTab : "content";
  const product = Number.isInteger(id) ? await db.query.products.findFirst({ where: eq(schema.products.id, id) }) : undefined;
  if (!product || product.kind !== "workshop") notFound();

  const [roster, customers, catalogue] = await Promise.all([
    workshopRoster(product.id),
    db.select({ id: schema.customers.id, name: schema.customers.name, email: schema.customers.email }).from(schema.customers).orderBy(desc(schema.customers.createdAt)).limit(500),
    tab === "details" ? Promise.all([adminCatalogue(), skuSuggestions()]) : null,
  ]);
  const name = pick({ en: product.name, ar: product.nameAr }, lang);
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Muscat" });
  const currencyLabel = lang === "ar" ? " ر.ع." : "OMR ";
  const empty = !product.workshopVideos.length && !product.workshopFiles.length;
  const term = q.trim().toLowerCase();
  const students = roster.students.filter((s) => !term || s.name.toLowerCase().includes(term) || s.email.includes(term));
  const withAccess = new Set(roster.students.map((s) => s.customerId));
  const base = `/admin/workshops/${product.id}`;

  return (
    <>
      <PageTitle
        title={name}
        back="/admin/workshops"
        backLabel={w.title}
        description={`${formatMoney(product.price, "OMR", lang)} · ${t.status[product.published ? "published" : "draft"]}`}
        actions={
          <>
            {product.published && (
              <a href={`/${lang}/products/${product.slug}`} target="_blank" rel="noopener" className={btnSecondaryCls}>
                <Icon name="external" size={16} className="rtl:-scale-x-100" /> {w.viewOnSite}
              </a>
            )}
            <form id="delete-workshop" action={deleteProduct}>
              <input type="hidden" name="id" value={product.id} />
            </form>
            <ConfirmAction
              form="delete-workshop"
              className={btnDangerCls}
              trigger={<><Icon name="trash" size={16} /> {t.common.delete}</>}
              title={w.deleteTitle}
              description={w.deleteText(name)}
              confirm={w.deleteConfirm}
              cancel={t.common.cancel}
            />
          </>
        }
      />

      <div className="space-y-3 empty:hidden">
        {created && <Notice tone="sky">{w.created}</Notice>}
        {product.published && empty && <Notice>{w.emptyWarning}</Notice>}
        {roster.unlinked.length > 0 && (
          <Notice action={tab !== "students" ? <Link href={`${base}?tab=students`} className={btnSecondaryCls}>{w.reviewStudents}</Link> : undefined}>
            {w.unlinkedWarning(roster.unlinked.length)}
          </Notice>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={w.stats.students} tone="sky" icon={<Icon name="users" />} value={<Count value={roster.students.length} />} />
        <Stat
          label={w.stats.revenue}
          tone="emerald"
          icon={<Icon name="wallet" />}
          value={<Count value={roster.revenue} decimals={3} prefix={lang === "ar" ? undefined : currencyLabel} suffix={lang === "ar" ? currencyLabel : undefined} />}
        />
        <Stat label={w.stats.lessons} tone="rose" icon={<Icon name="video" />} value={<Count value={product.workshopVideos.length} />} />
        <Stat label={w.files} tone="amber" icon={<Icon name="file" />} value={<Count value={product.workshopFiles.length} />} />
      </div>

      <div className="mt-8 mb-5">
        <SlidingTabs
          ariaLabel={name}
          value={tab}
          items={[
            { value: "content", label: w.tabs.content, href: base },
            { value: "students", label: w.tabs.students, href: `${base}?tab=students`, count: roster.students.length },
            { value: "details", label: w.tabs.details, href: `${base}?tab=details` },
          ]}
        />
      </div>

      {tab === "details" && catalogue ? (
        <ProductForm
          key={product.id}
          product={catalogue[0].products.find((p) => p.id === product.id)}
          categories={catalogue[0].categories}
          tags={catalogue[0].tags}
          skus={catalogue[1]}
          kind="workshop"
        />
      ) : tab === "content" ? (
        <WorkshopContent id={product.id} videos={product.workshopVideos} files={product.workshopFiles.map(({ id, name, size }) => ({ id, name, size }))} />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
          <Card
            title={`${w.studentsTitle} (${roster.students.length})`}
            description={w.studentsDesc}
            flush
            actions={
              roster.students.length > 0 && (
                <a href={`${base}/export`} className={btnSecondaryCls}>
                  <Icon name="download" size={16} /> {w.exportCsv}
                </a>
              )
            }
          >
            {roster.students.length > 4 && (
              <form className="border-b border-zinc-100 px-5 py-3">
                <input type="hidden" name="tab" value="students" />
                <span className="relative block max-w-sm">
                  <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-zinc-400"><Icon name="search" size={16} /></span>
                  <input name="q" defaultValue={q} placeholder={w.search} className={`${inputCls} ps-9`} />
                </span>
              </form>
            )}
            {students.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-100 bg-zinc-50/70 text-xs font-medium tracking-wide text-zinc-500 uppercase rtl:tracking-normal">
                    <tr>
                      <th className="px-5 py-3 text-start">{w.student}</th>
                      <th className="px-5 py-3 text-start">{w.access}</th>
                      <th className="px-5 py-3 text-start">{w.since}</th>
                      <th className="px-5 py-3"><span className="sr-only">{w.revoke}</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {students.map((s) => (
                      <tr key={s.customerId} className="transition-colors hover:bg-zinc-50/80">
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-soft to-zinc-100 text-sm font-semibold text-brand-ink uppercase" aria-hidden="true">
                              {s.name.trim().slice(0, 1) || s.email.slice(0, 1)}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-medium text-zinc-900">{s.name}</span>
                              <a href={`mailto:${s.email}`} className="block truncate text-xs text-zinc-500 hover:underline" dir="ltr">{s.email}</a>
                            </span>
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="flex flex-wrap gap-1.5">
                            {s.orders.map((o) => (
                              <Link key={o.id} href={`/admin/orders/${o.id}`} className="rounded-full transition hover:opacity-80">
                                <Badge status="paid" label={w.viaOrder(o.number)} />
                              </Link>
                            ))}
                            {s.manual && <Badge status="processing" label={w.manual} />}
                          </span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-zinc-500">{dateFmt.format(s.since)}</td>
                        <td className="px-5 py-3 text-end">
                          {s.manual && !s.orders.length && (
                            <>
                              <form id={`revoke-${s.customerId}`} action={revokeWorkshop}>
                                <input type="hidden" name="productId" value={product.id} />
                                <input type="hidden" name="customerId" value={s.customerId} />
                              </form>
                              <ConfirmAction
                                form={`revoke-${s.customerId}`}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-red-700 transition hover:bg-red-50"
                                trigger={w.revoke}
                                title={w.revokeTitle}
                                description={w.revokeText(s.name)}
                                confirm={w.revoke}
                                cancel={t.common.cancel}
                              />
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-400"><Icon name="users" size={22} /></span>
                <p className="text-sm text-zinc-500">{term ? w.noMatch : w.noStudents}</p>
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card title={w.grantTitle} description={w.grantDesc}>
              <GrantForm productId={product.id} customers={customers.filter((c) => !withAccess.has(c.id))} />
            </Card>

            {roster.unlinked.length > 0 && (
              <Card title={`${w.unlinked} (${roster.unlinked.length})`} description={w.unlinkedDesc} flush>
                <ul className="divide-y divide-zinc-100">
                  {roster.unlinked.map((g) => (
                    <li key={g.orderId} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-zinc-900">{g.name}</span>
                        <span className="block truncate text-xs text-zinc-500" dir="ltr">{g.email}</span>
                        <Link href={`/admin/orders/${g.orderId}`} className="text-xs text-zinc-500 hover:underline">
                          {w.viaOrder(g.number)} · {dateFmt.format(g.date)}
                        </Link>
                      </span>
                      {g.customerId ? (
                        <form action={linkGuestOrder} className="shrink-0">
                          <input type="hidden" name="productId" value={product.id} />
                          <input type="hidden" name="customerId" value={g.customerId} />
                          <button className={`${btnSecondaryCls} px-3 py-1.5 text-xs`}>{w.link}</button>
                        </form>
                      ) : (
                        <span className="shrink-0 text-end text-xs text-zinc-400">{w.noAccount}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
