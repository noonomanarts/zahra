"use client";

/* eslint-disable react-hooks/set-state-in-effect -- browser-only state (install prompt, connectivity, SW) is read after mount */
import Image from "next/image";
import { useEffect, useState } from "react";
import { useI18n } from "../providers/I18nProvider";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "zds-install-dismissed";
const VISITS_KEY = "zds-visits";
const SNOOZE_DAYS = 14;

const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

/** Service worker registration + install banner, offline badge and update notice. */
export default function PwaProvider() {
  const { t } = useI18n();
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [showInstall, setShowInstall] = useState<"prompt" | "ios" | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [online, setOnline] = useState(true);
  const [backOnline, setBackOnline] = useState(false);

  // --- service worker (production only: dev builds change on every edit)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        location.reload();
      }
    });
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
        });
      });
      // look for a new version when the app comes back to the foreground
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && reg.update());
    });
  }, []);

  // --- install banner: after the second visit, unless installed or dismissed recently
  useEffect(() => {
    if (isStandalone()) return;
    const visits = Number(storage.get(VISITS_KEY) ?? 0) + 1;
    storage.set(VISITS_KEY, String(visits));
    const dismissed = Number(storage.get(DISMISS_KEY) ?? 0);
    const snoozed = Date.now() - dismissed < SNOOZE_DAYS * 864e5;
    const ready = visits >= 2 && !snoozed;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
      if (ready) setTimeout(() => setShowInstall("prompt"), 4000);
    };
    const onInstalled = () => {
      setShowInstall(null);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // iOS Safari has no install prompt: show the "Add to Home Screen" hint instead
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (ready && isIos()) timer = setTimeout(() => setShowInstall("ios"), 6000);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(timer);
    };
  }, []);

  // --- connectivity
  useEffect(() => {
    setOnline(navigator.onLine);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const up = () => {
      setOnline(true);
      setBackOnline(true);
      timer = setTimeout(() => setBackOnline(false), 2500);
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    storage.set(DISMISS_KEY, String(Date.now()));
    setShowInstall(null);
  };
  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "dismissed") storage.set(DISMISS_KEY, String(Date.now()));
    setInstallEvent(null);
    setShowInstall(null);
  };

  return (
    <>
      {/* connectivity pill */}
      {(!online || backOnline) && (
        <div role="status" className="zds-rise fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
          <span className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white shadow-lg ${online ? "bg-emerald-600" : "bg-ink/90 backdrop-blur"}`}>
            <span className={`h-2 w-2 rounded-full ${online ? "bg-white" : "animate-pulse bg-amber-300"}`} />
            {online ? t.pwa.backOnline : t.pwa.offlineBadge}
          </span>
        </div>
      )}

      {/* update available */}
      {waiting && (
        <div role="status" className="zds-rise fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
          <div className="flex items-center gap-4 rounded-2xl bg-ink px-5 py-3 text-sm text-white shadow-2xl">
            {t.pwa.updateText}
            <button
              onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
              className="rounded-full bg-brand px-4 py-1.5 font-medium transition hover:bg-brand-dark"
            >
              {t.pwa.update}
            </button>
          </div>
        </div>
      )}

      {/* install banner */}
      {showInstall && !waiting && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:bottom-4">
          <div
            role="dialog"
            aria-labelledby="pwa-install-title"
            className="zds-rise flex w-full max-w-md items-center gap-4 rounded-3xl border border-white bg-white/95 p-4 shadow-[0_20px_60px_-15px_rgba(164,110,98,0.45)] backdrop-blur"
          >
            <Image src="/icons/icon-192.png" alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <p id="pwa-install-title" className="font-semibold text-ink">{t.pwa.installTitle}</p>
              <p className="mt-0.5 text-sm leading-snug text-muted">
                {showInstall === "ios" ? (
                  <>
                    {t.pwa.iosText}{" "}
                    <svg className="inline h-4 w-4 align-text-bottom text-brand-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" />
                    </svg>
                  </>
                ) : (
                  t.pwa.installText
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              {showInstall === "prompt" && (
                <button onClick={install} className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark">
                  {t.pwa.install}
                </button>
              )}
              <button onClick={dismiss} className="rounded-full px-4 py-1.5 text-xs text-muted transition hover:bg-brand-soft">
                {t.pwa.notNow}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
