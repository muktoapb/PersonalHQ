"use client";

import { Moon, Sun } from "@phosphor-icons/react/ssr";
import { useState, useSyncExternalStore } from "react";
import { setThemeAction } from "@/lib/actions/theme";

type Theme = "light" | "dark";

const query = "(prefers-color-scheme: dark)";
const subscribe = (cb: () => void) => {
  const m = matchMedia(query);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

// Sun/moon pill. The choice is stored in a cookie by the server, which then
// re-renders <html data-theme> (see app/layout.tsx).
export function ThemeToggle({ initial }: { initial?: Theme }) {
  const [picked, setPicked] = useState(initial);
  const systemDark = useSyncExternalStore(subscribe, () => matchMedia(query).matches, () => null);
  const current = picked ?? (systemDark === null ? undefined : systemDark ? "dark" : "light");

  const pick = (t: Theme) => {
    setPicked(t);
    void setThemeAction(t);
  };

  return (
    <div role="group" aria-label="Theme" className={`inline-flex rounded-full bg-accent shadow-md shadow-accent/25 gap-1 p-1`}>
      {(
        [
          ["light", Sun, "Light theme"],
          ["dark", Moon, "Dark theme"],
        ] as const
      ).map(([t, Icon, label]) => (
        <button
          key={t}
          onClick={() => pick(t)}
          aria-label={label}
          aria-pressed={current === t}
          className={`rounded-full transition p-2.5 ${current === t ? "bg-accent-strong text-white shadow-md ring-1 ring-black/25" : "text-white/60 hover:text-white"}`}
        >
          <Icon size={22} />
        </button>
      ))}
    </div>
  );
}
