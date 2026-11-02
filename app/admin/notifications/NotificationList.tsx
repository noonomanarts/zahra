"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Icon } from "@/components/admin/icons";
import { notificationIcon, notificationText } from "@/components/admin/NotificationBell";
import { markRead } from "./actions";

type Item = { id: number; kind: string; params: Record<string, string>; href: string | null; createdAt: number; read: boolean };

export default function NotificationList({ items }: { items: Item[] }) {
  const { lang, t } = useAdminI18n();
  const n = t.notifications;
  const [, start] = useTransition();
  const dateFmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" });
  const read = (id: number) => start(() => markRead(id));
  return (
    <ul className="divide-y divide-zinc-100">
      {items.map((item) => {
        const text = notificationText(t, item);
        const look = notificationIcon(item.kind);
        return (
          <li key={item.id} className={`flex items-start gap-3 px-4 py-3.5 sm:px-5 ${item.read ? "" : "bg-brand-soft/25"}`}>
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${look.cls}`}><Icon name={look.icon} size={17} /></span>
            <div className="min-w-0 flex-1 text-sm">
              {item.href ? <Link href={item.href} onClick={() => { if (!item.read) read(item.id); }} className={`hover:underline ${item.read ? "text-zinc-700" : "font-semibold text-zinc-900"}`}>{text.title}</Link> : <p className={item.read ? "text-zinc-700" : "font-semibold text-zinc-900"}>{text.title}</p>}
              {text.detail && <p className="mt-0.5 break-words text-zinc-500" dir="auto">{text.detail}</p>}
              {item.params.message && <p className="mt-2 rounded-lg bg-zinc-50 p-3 whitespace-pre-line text-zinc-800 ring-1 ring-zinc-100" dir="auto">{item.params.message}</p>}
              {item.kind === "contact.message" && item.params.email && <a href={`mailto:${encodeURIComponent(item.params.email)}?subject=${encodeURIComponent(`Re: ${item.params.subject ?? ""}`)}`} className="mt-2 inline-block text-xs font-medium text-brand-dark hover:underline">{n.reply}</a>}
              <p className="mt-1 text-xs text-zinc-400">{dateFmt.format(item.createdAt)}</p>
            </div>
            {!item.read && <button type="button" onClick={() => read(item.id)} aria-label={n.markOne} title={n.markOne} className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"><Icon name="check" size={16} /></button>}
          </li>
        );
      })}
    </ul>
  );
}
