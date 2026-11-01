import Money from "@/components/Money";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

const TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800",
  failed: "bg-red-50 text-red-700",
  cancelled: "bg-zinc-100 text-zinc-600",
  completed: "bg-zinc-100 text-zinc-700",
  shipped: "bg-indigo-50 text-indigo-800",
  new: "bg-sky-50 text-sky-800",
  quoted: "bg-amber-50 text-amber-800",
};

export function StatusPill({ lang, status }: { lang: Locale; status: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${TONE[status] ?? "bg-emerald-50 text-emerald-800"}`}>
      {getDictionary(lang).account.statuses[status] ?? status}
    </span>
  );
}

export const accountDate = (lang: Locale, date: Date) =>
  new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Muscat" }).format(date);

type Order = { id: number; number: string; status: string; total: number; createdAt: Date; items: { id: number; name: string; quantity: number }[] };

export function OrderList({ lang, orders }: { lang: Locale; orders: Order[] }) {
  const a = getDictionary(lang).account;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
      {orders.map((o) => (
        <li key={o.id} className="grid gap-x-6 gap-y-2 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <div className="min-w-0">
            <p className="font-semibold" dir="ltr">{o.number}</p>
            <p className="mt-0.5 truncate text-sm text-muted">
              {accountDate(lang, o.createdAt)} · {o.items.map((i) => (i.quantity > 1 ? `${i.name} × ${i.quantity}` : i.name)).join(lang === "ar" ? "، " : ", ")}
            </p>
          </div>
          <StatusPill lang={lang} status={o.status} />
          <p className="font-semibold sm:text-end">
            <span className="sr-only">{a.total}: </span>
            <Money amount={o.total} />
          </p>
        </li>
      ))}
    </ul>
  );
}
