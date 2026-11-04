"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react/ssr";
import { useEffect, useSyncExternalStore } from "react";
import { haptic } from "@/lib/haptics";

// Show or hide wallet balances (<Balance>). Hidden is the default: opening a
// page with balances hides them again, and tapping the eye reveals every
// balance on the page at once (<html data-show-balances>).
const ATTR = "data-show-balances";

const subscribe = (cb: () => void) => {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: [ATTR] });
  return () => o.disconnect();
};
const isShown = () => document.documentElement.hasAttribute(ATTR);

export function BalanceToggle({ className = "" }: { className?: string }) {
  const shown = useSyncExternalStore(subscribe, isShown, () => false);
  useEffect(() => {
    document.documentElement.removeAttribute(ATTR); // a new page starts hidden
    return () => document.documentElement.removeAttribute(ATTR);
  }, []);
  return (
    <button
      type="button"
      onClick={() => { haptic(); document.documentElement.toggleAttribute(ATTR); }}
      aria-pressed={shown}
      aria-label={shown ? "Hide balances" : "Show balances"}
      title={shown ? "Hide balances" : "Show balances"}
      className={`grid size-9 shrink-0 place-items-center rounded-full transition ${className}`}
    >
      {shown ? <Eye size={18} /> : <EyeSlash size={18} />}
    </button>
  );
}
