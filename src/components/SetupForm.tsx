"use client";

import { Check, Desktop, Moon, Sun } from "@phosphor-icons/react/ssr";
import { useActionState, useState } from "react";
import { setupAction } from "@/lib/actions/auth";
import { PALETTES, type PaletteKey } from "@/lib/palettes";
import { RecoveryKeyNotice } from "./AccountForms";

// First run: your name, a username, a password and how it should look.
// Everything else (currency, number format…) starts with defaults and lives in
// Settings.

type Mode = "light" | "dark" | "system";
const YEAR = 60 * 60 * 24 * 365;

// The look is applied at once and kept in the same cookies Settings uses.
// (Plain cookies, not a server action: setting cookies from an action would
// refresh /setup, which redirects away once the account exists.)
function applyLook(mode: Mode, palette: PaletteKey) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  if (palette === "lavender") root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", palette);
  document.cookie = mode === "system" ? "theme=; path=/; max-age=0" : `theme=${mode}; path=/; max-age=${YEAR}; samesite=lax`;
  document.cookie = palette === "lavender" ? "palette=; path=/; max-age=0" : `palette=${palette}; path=/; max-age=${YEAR}; samesite=lax`;
}

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, {});
  const [mode, setMode] = useState<Mode>("system");
  const [palette, setPalette] = useState<PaletteKey>("lavender");
  const pick = (m: Mode, p: PaletteKey) => { setMode(m); setPalette(p); applyLook(m, p); };

  if (state.recoveryKey) return <RecoveryKeyNotice recoveryKey={state.recoveryKey} next="/login" nextLabel="Sign in" />;
  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="label" htmlFor="displayName">Your name</label>
        <input id="displayName" name="displayName" defaultValue={state.values?.displayName} required maxLength={80} autoFocus className="input" autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" name="username" defaultValue={state.values?.username} required minLength={3} maxLength={32} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="input" autoComplete="username" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={10} className="input" autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" required minLength={10} className="input" autoComplete="new-password" />
        </div>
        <p className="-mt-2 text-xs text-ink-3 sm:col-span-2">At least 10 characters. A passphrase of a few random words works well.</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="label">Look</legend>
        <div role="radiogroup" aria-label="Light or dark" className="grid grid-cols-3 gap-2">
          {([["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "Auto", Desktop]] as const).map(([m, label, Icon]) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => pick(m, palette)}
              className={`flex items-center justify-center gap-2 rounded-2xl border p-2.5 text-sm transition ${mode === m ? "border-accent bg-accent-soft font-medium" : "border-rule hover:border-accent/40"}`}>
              <Icon size={18} weight={mode === m ? "fill" : "regular"} /> {label}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-4 gap-2">
          {PALETTES.map((p) => {
            const on = palette === p.key, glass = p.key === "glass";
            return (
              <button key={p.key} type="button" role="radio" aria-checked={on} aria-label={p.label} title={p.label} onClick={() => pick(mode, p.key)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-2 text-[11px] transition ${on ? "border-accent bg-accent-soft font-medium" : "border-rule hover:border-accent/40"}`}>
                <span
                  className="relative grid h-8 w-full place-items-center rounded-lg"
                  style={{ background: glass ? `linear-gradient(135deg, ${p.swatch[0]}, ${p.swatch[1]}, ${p.swatch[2]})` : p.swatch[0] }}
                >
                  <span className="size-3.5 rounded-full" style={{ background: glass ? "oklch(0.6 0.19 258)" : p.swatch[1] }} />
                  {on && <Check size={12} weight="bold" className="absolute right-1 top-1 text-ink" />}
                </span>
                <span className="truncate">{p.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary w-full">{pending ? "Setting up…" : "Create my dashboard"}</button>
      <p className="text-center text-xs text-ink-3">Currency, space name and the rest can be changed any time in Settings.</p>
    </form>
  );
}
