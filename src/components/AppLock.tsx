"use client";

import { useEffect } from "react";
import { keepUnlockedAction, lockStatusAction } from "@/lib/actions/lock";

// With an app PIN set: using the app (taps, keys) keeps it unlocked; once the
// lock period passes without use, or on coming back to the app after it, go
// to the lock screen. The server enforces the same rule on every page.
export function AppLock({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let until = 0, lastPing = 0, timer: ReturnType<typeof setTimeout> | undefined;
    // A full page load, so nothing on this page can render (or race the server's own redirect).
    const lock = () => location.replace(`/unlock?next=${encodeURIComponent(location.pathname + location.search)}`);
    const apply = (r: { until: number | null } | { locked: true }) => {
      if ("locked" in r) return lock();
      if (r.until === null) return; // the PIN was removed
      until = r.until;
      clearTimeout(timer);
      timer = setTimeout(check, Math.max(0, until - Date.now()) + 500);
    };
    // Time's up here, but another tab may have kept it unlocked.
    const check = () => { if (Date.now() >= until) lockStatusAction().then(apply, () => {}); };
    const ping = () => {
      if (Date.now() - lastPing < 30_000) return;
      lastPing = Date.now();
      keepUnlockedAction().then(apply, () => {});
    };
    const onVisible = () => { if (document.visibilityState === "visible") { check(); ping(); } };
    ping();
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, ping, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, ping);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
  return null;
}
