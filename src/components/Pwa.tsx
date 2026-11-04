"use client";

import { DeviceMobile, DownloadSimple, Export, X } from "@phosphor-icons/react/ssr";
import { useEffect, useState, useSyncExternalStore } from "react";

// Installable-app helpers: service worker registration, the install prompt
// (Chrome/Edge/Android give us an event; iOS needs Share → Add to Home
// Screen), and the offline screen's retry button.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// The browser fires beforeinstallprompt once, early; keep it for whoever asks.
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

type Mode = "installed" | "prompt" | "ios" | "unsupported";
function getMode(): Mode {
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  if (deferred) return "prompt";
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
  return "unsupported";
}
const useInstallMode = () => useSyncExternalStore(subscribe, getMode, () => "unsupported" as Mode);

async function install() {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  notify();
}

// Registered in production only, so dev builds never serve stale chunks.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

const IosSteps = () => (
  <span>
    Tap <Export size={15} className="inline align-[-2px]" aria-label="Share" /> <b>Share</b>, then <b>Add to Home Screen</b>.
  </span>
);

// Settings card: install, or how to, or "already installed".
export function InstallApp() {
  const mode = useInstallMode();
  return (
    <div className="space-y-3 text-sm text-ink-2">
      {mode === "installed" && <p>You&apos;re using the installed app.</p>}
      {mode === "prompt" && (
        <>
          <p>Install the dashboard as an app: its own icon, full screen, and shortcuts to add a task or a note.</p>
          <button onClick={install} className="btn btn-primary"><DownloadSimple size={16} /> Install app</button>
        </>
      )}
      {mode === "ios" && <p>To install on iPhone or iPad, open this page in Safari. <IosSteps /></p>}
      {mode === "unsupported" && <p>Open this page in Chrome or Edge (Android, Windows, Mac) or Safari (iPhone) to install it as an app.</p>}
    </div>
  );
}

const DISMISS_KEY = "install-banner-dismissed";

// Phones and tablets: a one-time banner above the tab bar until installed or dismissed.
export function InstallBanner() {
  const mode = useInstallMode();
  // Read once on the client; the banner renders nothing until hydrated anyway
  // (the install mode starts as "unsupported").
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (hidden || (mode !== "prompt" && mode !== "ios")) return null;
  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  };
  return (
    <div role="region" aria-label="Install app" className="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2 z-30 flex items-center gap-3 rounded-2xl border border-rule bg-surface p-3 shadow-lg lg:hidden">
      <DeviceMobile size={28} className="shrink-0 text-accent-text" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Get the app</p>
        <p className="text-xs text-ink-2">{mode === "ios" ? <IosSteps /> : "Full screen, on your home screen."}</p>
      </div>
      {mode === "prompt" && <button onClick={install} className="btn btn-primary shrink-0 px-3 py-1.5 text-xs">Install</button>}
      <button onClick={dismiss} aria-label="Not now" className="shrink-0 rounded-full p-1.5 text-ink-3 hover:bg-surface-2"><X size={16} /></button>
    </div>
  );
}

export function RetryButton() {
  return <button onClick={() => location.reload()} className="btn btn-primary">Try again</button>;
}
