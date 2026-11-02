"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { markAllRead, markRead } from "@/app/admin/notifications/actions";
import type { AdminDictionary } from "@/lib/i18n/admin";
import { useAdminI18n } from "./AdminI18n";
import { Icon, type IconName } from "./icons";

type Item = { id: number; kind: string; params: Record<string, string>; href: string | null; createdAt: number; read: boolean };
type Feed = { unread: number; items: Item[]; refresh: () => void; read: (id: number) => void; readAll: () => void; sound: boolean; toggleSound: () => void; desktop: NotificationPermission | "unsupported"; askDesktop: () => void };

const POLL_MS = 15_000;
const Context = createContext<Feed | null>(null);

const ICONS: Record<string, { icon: IconName; cls: string }> = {
  "order.paid": { icon: "wallet", cls: "bg-emerald-50 text-emerald-600" },
  "order.received": { icon: "orders", cls: "bg-sky-50 text-sky-600" },
  "delivery.manual": { icon: "file", cls: "bg-amber-50 text-amber-600" },
  "payment.failed": { icon: "alert", cls: "bg-red-50 text-red-600" },
  "payment.mismatch": { icon: "alert", cls: "bg-red-50 text-red-600" },
  "request.new": { icon: "requests", cls: "bg-sky-50 text-sky-600" },
  "review.new": { icon: "star", cls: "bg-amber-50 text-amber-600" },
  "customer.new": { icon: "userPlus", cls: "bg-rose-50 text-rose-600" },
  "contact.message": { icon: "mail", cls: "bg-indigo-50 text-indigo-600" },
  "stock.low": { icon: "box", cls: "bg-amber-50 text-amber-600" },
  "stock.out": { icon: "box", cls: "bg-red-50 text-red-600" },
  "email.failed": { icon: "alert", cls: "bg-amber-50 text-amber-600" },
};

export const notificationIcon = (kind: string) => ICONS[kind] ?? { icon: "alert" as IconName, cls: "bg-zinc-100 text-zinc-600" };

export function notificationText(t: AdminDictionary, item: Pick<Item, "kind" | "params">) {
  const render = t.notifications.kinds[item.kind];
  return render ? render(item.params) : { title: item.kind, detail: "" };
}

/** A short two-note chime made in the browser, so there is no sound file to host. */
function chime() {
  try {
    const audio = new AudioContext();
    [880, 1175].forEach((frequency, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const at = audio.currentTime + i * 0.14;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.15, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      osc.connect(gain).connect(audio.destination);
      osc.start(at);
      osc.stop(at + 0.4);
    });
  } catch { /* browsers may block sound until the page has been clicked */ }
}

/** Watches for news while the panel is open: count, title, toast, chime and desktop alert. */
export function NotificationProvider({ initialUnread, enabled, children }: { initialUnread: number; enabled: boolean; children: React.ReactNode }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Item[]>([]);
  const [toasts, setToasts] = useState<Item[]>([]);
  const [sound, setSound] = useState(false);
  const [desktop, setDesktop] = useState<Feed["desktop"]>("unsupported");
  const newest = useRef<number | null>(null);
  const soundOn = useRef(false);
  const baseTitle = useRef<string | null>(null);
  const langT = useRef(t);
  const path = useRef(pathname);
  useEffect(() => {
    langT.current = t;
    path.current = pathname;
  }, [t, pathname]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/notifications", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const data = (await response.json()) as { unread: number; items: Item[] };
    setUnread(data.unread);
    setItems(data.items);
    const top = data.items[0]?.id ?? 0;
    // the first answer only sets the starting point: old news isn't announced again on every page load
    if (newest.current !== null && top > newest.current) {
      const fresh = data.items.filter((i) => i.id > newest.current! && !i.read).slice(0, 3);
      setToasts((list) => [...fresh, ...list].slice(0, 3));
      if (fresh.length && soundOn.current) chime();
      if (fresh.length && document.hidden && "Notification" in window && Notification.permission === "granted") {
        for (const item of fresh) {
          const text = notificationText(langT.current, item);
          new Notification(text.title, { body: text.detail, tag: `n-${item.id}` });
        }
      }
      // pages showing live figures catch up by themselves
      if (path.current === "/admin" || path.current === "/admin/notifications") router.refresh();
    }
    newest.current = Math.max(top, newest.current ?? 0);
  }, [router]);

  useEffect(() => {
    if (!enabled) return;
    /* eslint-disable react-hooks/set-state-in-effect -- preferences and permissions only exist in the browser */
    setSound(localStorage.getItem("admin_notification_sound") === "on");
    soundOn.current = localStorage.getItem("admin_notification_sound") === "on";
    if ("Notification" in window) setDesktop(Notification.permission);
    refresh();
    /* eslint-enable react-hooks/set-state-in-effect */
    // keeps going in a background tab, where it matters most; browsers slow the timer down there by themselves
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => setToasts([]), 8000);
    return () => clearTimeout(timer);
  }, [toasts]);

  useEffect(() => {
    if (baseTitle.current === null || !document.title.includes(baseTitle.current)) baseTitle.current = document.title.replace(/^\(\d+\+?\) /, "");
    document.title = unread ? `(${unread > 99 ? "99+" : unread}) ${baseTitle.current}` : baseTitle.current;
  }, [unread, pathname]);

  const value = useMemo<Feed>(() => ({
    unread,
    items,
    refresh,
    sound,
    desktop,
    read: (id) => {
      setItems((list) => list.map((i) => (i.id === id ? { ...i, read: true } : i)));
      setUnread((c) => Math.max(c - 1, 0));
      void markRead(id);
    },
    readAll: () => {
      setItems((list) => list.map((i) => ({ ...i, read: true })));
      setUnread(0);
      void markAllRead();
    },
    toggleSound: () => {
      const next = !soundOn.current;
      soundOn.current = next;
      setSound(next);
      localStorage.setItem("admin_notification_sound", next ? "on" : "off");
      if (next) chime();
    },
    askDesktop: () => { void Notification.requestPermission().then(setDesktop); },
  }), [unread, items, refresh, sound, desktop]);

  return (
    <Context.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed end-4 bottom-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((item) => {
          const text = notificationText(t, item);
          const look = notificationIcon(item.kind);
          return (
            <Link key={item.id} href={item.href ?? "/admin/notifications"} onClick={() => { value.read(item.id); setToasts((l) => l.filter((x) => x.id !== item.id)); }} className="zds-rise pointer-events-auto flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-xl transition hover:border-zinc-300">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${look.cls}`}><Icon name={look.icon} size={17} /></span>
              <span className="min-w-0 text-sm">
                <span className="block font-semibold text-zinc-900">{text.title}</span>
                {text.detail && <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500" dir="auto">{text.detail}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </Context.Provider>
  );
}

const ago = (time: number, lang: string) => {
  const seconds = Math.round((time - Date.now()) / 1000);
  const fmt = new Intl.RelativeTimeFormat(lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB", { numeric: "auto", style: "short" });
  for (const [limit, unit, size] of [[60, "second", 1], [3600, "minute", 60], [86400, "hour", 3600]] as const) {
    if (Math.abs(seconds) < limit) return fmt.format(Math.round(seconds / size), unit);
  }
  return fmt.format(Math.round(seconds / 86400), "day");
};

/** The bell and its panel. Shown in the sidebar and in the top bar on small screens. */
export default function NotificationBell() {
  const feed = useContext(Context);
  const { lang, t } = useAdminI18n();
  const n = t.notifications;
  const [open, setOpen] = useState(false);
  if (!feed) return null;
  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) feed.refresh(); }}>
      <Popover.Trigger aria-label={feed.unread ? n.bellUnread(feed.unread) : n.bell} className="relative grid size-10 shrink-0 place-items-center rounded-lg text-zinc-600 transition outline-none hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900">
        <Icon name="bell" size={20} />
        {feed.unread > 0 && <span className="absolute end-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white" aria-hidden="true">{feed.unread > 99 ? "99+" : feed.unread}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content dir={lang === "ar" ? "rtl" : "ltr"} align="start" sideOffset={8} collisionPadding={12} className="zds-rise z-50 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl outline-none">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-900">{n.title}</p>
            {feed.unread > 0 && <button type="button" onClick={feed.readAll} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">{n.markAll}</button>}
          </div>
          {feed.items.length ? (
            <ul className="max-h-[60vh] divide-y divide-zinc-100 overflow-y-auto">
              {feed.items.map((item) => {
                const text = notificationText(t, item);
                const look = notificationIcon(item.kind);
                return (
                  <li key={item.id}>
                    <Link href={item.href ?? "/admin/notifications"} onClick={() => { if (!item.read) feed.read(item.id); setOpen(false); }} className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 ${item.read ? "" : "bg-brand-soft/30"}`}>
                      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${look.cls}`}><Icon name={look.icon} size={15} /></span>
                      <span className="min-w-0 flex-1 text-sm">
                        <span className={`block ${item.read ? "text-zinc-700" : "font-semibold text-zinc-900"}`}>{text.title}</span>
                        {text.detail && <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500" dir="auto">{text.detail}</span>}
                        <span className="mt-0.5 block text-[11px] text-zinc-400">{ago(item.createdAt, lang)}</span>
                      </span>
                      {!item.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-dark" aria-label={n.unread} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <p className="px-4 py-10 text-center text-sm text-zinc-500">{n.empty}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/70 px-4 py-2.5 text-xs">
            <Link href="/admin/notifications" onClick={() => setOpen(false)} className="font-medium text-zinc-700 hover:text-zinc-900">{n.viewAll}</Link>
            <span className="flex items-center gap-3">
              <button type="button" onClick={feed.toggleSound} aria-pressed={feed.sound} className="text-zinc-500 hover:text-zinc-900">{feed.sound ? n.soundOn : n.soundOff}</button>
              {feed.desktop === "default" && <button type="button" onClick={feed.askDesktop} className="text-zinc-500 hover:text-zinc-900">{n.enableDesktop}</button>}
              {feed.desktop === "granted" && <span className="text-emerald-700">{n.desktopOn}</span>}
            </span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
