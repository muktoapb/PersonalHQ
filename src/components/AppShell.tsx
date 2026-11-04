"use client";

import { ArrowClockwise, Funnel } from "@phosphor-icons/react/ssr";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition, ViewTransition } from "react";
import { haptic } from "@/lib/haptics";

// App behaviour for the signed-in shell on phones and portrait tablets.
// Desktop is unaffected: the gestures only run on touch screens below lg and
// the page animation is switched off on lg+ in globals.css.

// Touch screens with the app shell (phones, portrait tablets); bottom sheets
// are only sheets on phones.
const isTouchShell = () => matchMedia("(max-width: 1023px) and (pointer: coarse)").matches;
const isPhone = () => matchMedia("(max-width: 639px) and (pointer: coarse)").matches;

// Pages fade up as they arrive (a route change remounts this keyed wrapper);
// updates inside a page don't animate.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <ViewTransition key={path} enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}

const PULL = 64; // px (after resistance) needed to refresh

// Pull down at the top of a page to reload its data.
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [busy, start] = useTransition();

  useEffect(() => {
    let y0: number | null = null;
    let dist = 0;
    const reset = () => { y0 = null; dist = 0; setPull(0); };
    const down = (e: TouchEvent) => {
      y0 = isTouchShell() && window.scrollY <= 0 && e.touches.length === 1 && !document.querySelector("dialog[open]") ? e.touches[0].clientY : null;
    };
    const move = (e: TouchEvent) => {
      if (y0 === null) return;
      // A note being dragged, or the page scrolled: not a pull.
      if (document.documentElement.dataset.dragging || window.scrollY > 0) return reset();
      dist = Math.min(Math.max(0, e.touches[0].clientY - y0) * 0.5, PULL * 1.4);
      setPull(dist);
    };
    const up = () => {
      if (y0 === null) return;
      if (dist >= PULL) {
        haptic();
        start(() => router.refresh());
      }
      reset();
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", reset);
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", reset);
    };
  }, [router]);

  if (!pull && !busy) return null;
  const y = busy ? PULL : pull;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-40 flex justify-center sm:hidden"
      style={{ transform: `translateY(${y - 40}px)`, opacity: busy ? 1 : Math.min(1, pull / PULL), transition: pull ? "none" : "transform .2s, opacity .2s" }}
    >
      <span className="grid size-9 place-items-center rounded-full border border-rule bg-surface text-accent-text shadow-md">
        <ArrowClockwise size={18} weight="bold" className={busy ? "animate-spin" : ""} style={busy ? undefined : { transform: `rotate(${(pull / PULL) * 270}deg)` }} />
      </span>
    </div>
  );
}

// Bottom sheets (dialog.sheet): drag down from the top of the sheet to close.
export function SheetGestures() {
  useEffect(() => {
    let s: { el: HTMLDialogElement; y0: number; dy: number; t0: number } | null = null;
    const down = (e: TouchEvent) => {
      const target = e.target as Element;
      const el = target.closest<HTMLDialogElement>("dialog.sheet[open]");
      s = el && isPhone() && el.scrollTop <= 0 && !target.closest("input, textarea, select, [contenteditable=true]")
        ? { el, y0: e.touches[0].clientY, dy: 0, t0: Date.now() }
        : null;
    };
    const move = (e: TouchEvent) => {
      if (!s) return;
      s.dy = e.touches[0].clientY - s.y0;
      if (s.dy <= 0 || s.el.scrollTop > 0) {
        s.el.style.transform = "";
        if (s.dy < -6) s = null; // scrolling the sheet up
        return;
      }
      s.el.style.transition = "none";
      s.el.style.transform = `translateY(${s.dy}px)`;
    };
    const up = () => {
      if (!s) return;
      const { el, dy, t0 } = s;
      s = null;
      el.style.transition = "";
      if (dy > 120 || (dy > 50 && Date.now() - t0 < 250)) {
        haptic();
        el.style.transform = "";
        el.close();
      } else {
        el.style.transform = "";
      }
    };
    document.addEventListener("touchstart", down, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", up);
    document.addEventListener("touchcancel", up);
    return () => {
      document.removeEventListener("touchstart", down);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", up);
      document.removeEventListener("touchcancel", up);
    };
  }, []);
  return null;
}

// True once the page has scrolled past `y` (for the compact top-bar title).
const onScroll = (cb: () => void) => {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
};
export const useScrolledPast = (y: number) => useSyncExternalStore(onScroll, () => window.scrollY > y, () => false);

// ---------- section menu (phones) ----------
// SideNav owns the sheet listing a section's pages (task groups, note
// categories); the filter button on a page opens it with this event.
export const SECTION_MENU_EVENT = "open-section-menu";
const openSectionMenu = () => {
  if (matchMedia("(max-width: 1023px)").matches) window.dispatchEvent(new Event(SECTION_MENU_EVENT));
};

// The filter button at the right of a title row (app shell only, below lg).
export function SectionFilterButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={openSectionMenu} aria-label={label} aria-haspopup="dialog" className="ml-auto grid size-10 shrink-0 place-items-center rounded-full border border-rule bg-surface text-ink-2 lg:hidden">
      <Funnel size={18} />
    </button>
  );
}

// ---------- desktop scrolling ----------
// Desktop (lg+, mouse/trackpad) panes scroll like a native app's: the
// scrollbar shows while a pane scrolls or the pointer nears its right edge
// ([data-scrolling]), and each page's scroll position is remembered for when
// you come back to it. Styles in globals.css.

const isDesktop = () => matchMedia("(min-width: 1024px) and (pointer: fine)").matches;
const positions = new Map<string, number>(); // pathname -> main.scrollTop

// The nearest ancestor that actually scrolls vertically.
function scroller(el: Element | null): HTMLElement | null {
  for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) return n as HTMLElement;
  }
  return null;
}

export function DesktopScroll() {
  const path = usePathname();

  useEffect(() => {
    const timers = new WeakMap<Element, number>();
    const show = (el: HTMLElement, ms: number) => {
      el.setAttribute("data-scrolling", "");
      clearTimeout(timers.get(el));
      timers.set(el, window.setTimeout(() => el.removeAttribute("data-scrolling"), ms));
    };
    const onScroll = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLElement) || !isDesktop()) return;
      show(el, 900);
      if (el.tagName === "MAIN") positions.set(location.pathname, el.scrollTop);
    };
    let frame = 0;
    const onMove = (e: MouseEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!isDesktop()) return;
        const el = scroller(e.target as Element);
        if (el && e.clientX > el.getBoundingClientRect().right - 18) show(el, 700);
      });
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Back on a page you've seen: return to where you were, once its content
  // is tall enough (it may still be loading), unless you start scrolling.
  useEffect(() => {
    const main = document.querySelector("main");
    const y = positions.get(path);
    if (!main || !y || !isDesktop()) return;
    let frame = 0, cancelled = false;
    const stop = () => { cancelled = true; };
    const until = performance.now() + 1500;
    const tick = () => {
      if (cancelled) return;
      if (main.scrollHeight - main.clientHeight >= y || performance.now() > until) {
        main.scrollTop = y;
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    main.addEventListener("wheel", stop, { once: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      main.removeEventListener("wheel", stop);
    };
  }, [path]);

  return null;
}
