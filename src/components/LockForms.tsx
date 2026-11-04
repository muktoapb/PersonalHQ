"use client";

import { LockSimple } from "@phosphor-icons/react/ssr";
import { useActionState, useState, useTransition } from "react";
import { lockMinutesAction, lockNowAction, removePinAction, setPinAction, unlockAction, usePasswordAction } from "@/lib/actions/lock";

const LOCK_OPTIONS = [
  { value: 1, label: "1 minute" },
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 60, label: "1 hour" },
];

const pinInput = "input text-center text-2xl tracking-[0.5em] tabular-nums";

// The lock screen's form.
export function UnlockForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(unlockAction, {});
  return (
    <div className="w-full space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <input
          name="pin" type="password" inputMode="numeric" pattern="\d{4,6}" minLength={4} maxLength={6} required autoFocus
          autoComplete="off" aria-label="PIN" placeholder="••••" className={pinInput}
        />
        {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        <button disabled={pending} className="btn btn-primary w-full">{pending ? "Checking…" : "Unlock"}</button>
      </form>
      <form action={usePasswordAction}>
        <button className="text-sm text-accent-text hover:underline">Forgot your PIN? Use your password</button>
      </form>
    </div>
  );
}

function SetPinForm({ change }: { change: boolean }) {
  const [state, action, pending] = useActionState(setPinAction, {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pin">{change ? "New PIN" : "PIN"} (4–6 digits)</label>
          <input id="pin" name="pin" type="password" inputMode="numeric" pattern="\d{4,6}" minLength={4} maxLength={6} required autoComplete="off" className="input tabular-nums" />
        </div>
        <div>
          <label className="label" htmlFor="pin-confirm">Confirm PIN</label>
          <input id="pin-confirm" name="confirm" type="password" inputMode="numeric" pattern="\d{4,6}" minLength={4} maxLength={6} required autoComplete="off" className="input tabular-nums" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="pin-password">Your password</label>
        <input id="pin-password" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-income">{change ? "PIN changed." : "App lock is on."}</p>}
      <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : change ? "Change PIN" : "Turn on app lock"}</button>
    </form>
  );
}

function RemovePinForm() {
  const [state, action, pending] = useActionState(removePinAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1">
        <label className="label" htmlFor="pin-remove-password">Your password</label>
        <input id="pin-remove-password" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      <button disabled={pending} className="btn btn-danger">{pending ? "Removing…" : "Turn off app lock"}</button>
      {state.error && <p role="alert" className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}

// Settings › Profile: set a PIN, how soon it locks, lock now, change or remove.
export function AppLockSettings({ hasPin, minutes }: { hasPin: boolean; minutes: number }) {
  const [open, setOpen] = useState<"change" | "remove" | null>(null);
  const [saved, setSaved] = useState(minutes);
  const [pending, start] = useTransition();
  if (!hasPin) return <SetPinForm change={false} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <label className="label" htmlFor="lock-after">Lock after</label>
          <select
            id="lock-after" value={saved} disabled={pending} className="input"
            onChange={(e) => { const m = Number(e.target.value); setSaved(m); start(async () => { await lockMinutesAction(m); }); }}
          >
            {LOCK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label} without use</option>)}
          </select>
        </div>
        <form action={lockNowAction}>
          <button className="btn btn-ghost"><LockSimple size={16} /> Lock now</button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
        <button type="button" onClick={() => setOpen(open === "change" ? null : "change")} className="btn btn-ghost">Change PIN</button>
        <button type="button" onClick={() => setOpen(open === "remove" ? null : "remove")} className="btn btn-ghost text-danger">Turn off</button>
      </div>
      {open === "change" && <SetPinForm change />}
      {open === "remove" && <RemovePinForm />}
    </div>
  );
}
