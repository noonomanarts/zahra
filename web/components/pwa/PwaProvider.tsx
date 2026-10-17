"use client";

/* eslint-disable react-hooks/set-state-in-effect -- browser-only state (connectivity, SW) is read after mount */
import { useEffect, useState } from "react";
import { useI18n } from "../providers/I18nProvider";

/** Service worker registration, offline badge and update notice. */
export default function PwaProvider() {
  const { t } = useI18n();
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

  // Keep installation user-initiated through the browser's menu.
  useEffect(() => {
    const onPrompt = (event: Event) => event.preventDefault();
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
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
    </>
  );
}
