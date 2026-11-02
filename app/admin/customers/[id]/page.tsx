import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { customerOrders, customerRequests } from "@/lib/account";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/currency";
import { getAdminT } from "@/lib/i18n/admin-server";
import { can } from "@/lib/permissions";
import { PAID_STATUSES, customerWorkshops } from "@/lib/workshops";
import { Badge, Card, Notice, PageTitle, Stat } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { Avatar, timeAgo } from "@/components/admin/people";
import { REQUEST_BADGE } from "../../requests/badges";
import { CustomerActions, CustomerProfile } from "../CustomerForms";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const admin = await requireAdmin("customers.view");
  const { lang, t } = await getAdminT();
  const k = t.customers;
  const id = Number((await params).id);
  const customer = Number.isInteger(id) ? await db.query.customers.findFirst({ where: eq(schema.customers.id, id) }) : undefined;
  if (!customer) notFound();

  const has = (p: Parameters<typeof can>[1]) => can(admin.permissions, p);
  const editable = has("customers.manage");
  const [orders, requests, workshops, grants, [devices]] = await Promise.all([
    customerOrders(id),
    customerRequests(id),
    customerWorkshops(id, lang),
    db.select({ productId: schema.workshopGrants.productId }).from(schema.workshopGrants).where(eq(schema.workshopGrants.customerId, id)),
    db.select({ n: count() }).from(schema.customerSessions).where(and(eq(schema.customerSessions.customerId, id), gt(schema.customerSessions.expiresAt, new Date()))),
  ]);
  const granted = new Set(grants.map((g) => g.productId));
  const paid = orders.filter((o) => (PAID_STATUSES as readonly string[]).includes(o.status));
  const spent = paid.reduce((sum, o) => sum + o.total, 0);
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Muscat" });

  return (
    <>
      <PageTitle title={customer.name} back="/admin/customers" backLabel={k.back} />

      <div className="zds-rise mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,16,16,0.04)]">
        <Avatar name={customer.name} email={customer.email} large muted={Boolean(customer.disabledAt)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-zinc-500" dir="ltr">{customer.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {customer.disabledAt ? <Badge status="failed" label={k.status.suspended} /> : <Badge status="paid" label={k.status.active} />}
            <span>{k.joined}: {dateFmt.format(customer.createdAt)}</span>
            <span>· {k.lastLogin}: {customer.lastLoginAt ? timeAgo(customer.lastLoginAt, lang) : k.never}</span>
            <span className="flex items-center gap-1">· <Icon name="devices" size={13} /> {devices.n ? k.devices(devices.n) : k.noDevices}</span>
          </div>
        </div>
      </div>

      {customer.disabledAt && <div className="mb-6"><Notice>{k.suspendedNotice(dateFmt.format(customer.disabledAt))}</Notice></div>}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={k.spent} tone="emerald" icon={<Icon name="wallet" />} value={<bdi>{formatMoney(spent, "OMR", lang)}</bdi>} hint={k.spentHint} />
        <Stat label={k.orders} tone="sky" icon={<Icon name="orders" />} value={orders.length} />
        <Stat label={k.average} tone="rose" icon={<Icon name="finance" />} value={<bdi>{formatMoney(paid.length ? spent / paid.length : 0, "OMR", lang)}</bdi>} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card title={k.orders} description={k.guestNote} flush>
            {orders.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-zinc-100">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-zinc-50/80">
                        <td className="px-5 py-3 font-medium" dir="ltr">{has("orders.view") ? <Link href={`/admin/orders/${o.id}`} className="hover:underline">{o.number}</Link> : o.number}</td>
                        <td className="px-5 py-3 whitespace-nowrap text-zinc-500">{dateFmt.format(o.createdAt)}</td>
                        <td className="px-5 py-3"><Badge status={o.status} label={t.status[o.status]} /></td>
                        <td className="px-5 py-3 text-end whitespace-nowrap"><bdi>{formatMoney(o.total, "OMR", lang)}</bdi></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="px-5 py-8 text-center text-sm text-zinc-500">{k.noOrders}</p>}
          </Card>

          <Card title={k.workshops} flush>
            {workshops.length ? (
              <ul className="divide-y divide-zinc-100">
                {workshops.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0">
                      {has("workshops.view") ? <Link href={`/admin/workshops/${w.id}?tab=students`} className="block truncate font-medium text-zinc-900 hover:underline">{w.name}</Link> : <span className="block truncate font-medium text-zinc-900">{w.name}</span>}
                      <span className="block text-xs text-zinc-500">{dateFmt.format(w.since)}</span>
                    </span>
                    <Badge status={granted.has(w.id) ? "processing" : "paid"} label={granted.has(w.id) ? k.accessGranted : k.accessPurchased} />
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-8 text-center text-sm text-zinc-500">{k.noWorkshops}</p>}
          </Card>

          <Card title={k.requests} flush>
            {requests.length ? (
              <ul className="divide-y divide-zinc-100">
                {requests.map((r) => (
                  <li key={r.number} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium text-zinc-900">{t.requests.types[r.type]}</span>
                      <span className="block text-xs text-zinc-500"><bdi dir="ltr">{r.number}</bdi> · {dateFmt.format(r.createdAt)}</span>
                    </span>
                    <Badge status={REQUEST_BADGE[r.status]} label={t.requests.statuses[r.status]} />
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-8 text-center text-sm text-zinc-500">{k.noRequests}</p>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={k.profile}>
            <CustomerProfile id={customer.id} name={customer.name} email={customer.email} locked={!editable} />
          </Card>
          {editable && (
            <Card title={k.actions}>
              <CustomerActions id={customer.id} name={customer.name} suspended={Boolean(customer.disabledAt)} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
