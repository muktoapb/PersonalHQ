"use client";

import { Check, Copy, DownloadSimple, Key } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useActionState, useState } from "react";
import { completeAccountAction, forgotAction, recoveryKeyAction, usernameAction } from "@/lib/actions/auth";

// Sign-in identity and recovery: showing a new recovery key once, the forgot
// password form, finishing an older install's account, and the Profile
// controls for username and recovery key.

const Err = ({ error }: { error?: string }) => (error ? <p role="alert" className="text-sm text-danger">{error}</p> : null);

// A freshly made recovery key: copy or download it, confirm, continue.
export function RecoveryKeyNotice({ recoveryKey, next, nextLabel = "Continue" }: { recoveryKey: string; next?: string; nextLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const file = `data:text/plain;charset=utf-8,${encodeURIComponent(
    `PersonalHQ recovery key\n\n${recoveryKey}\n\nUse it with "Forgot password?" on the sign-in screen. It works once; a new one is made each time it's used.\n`,
  )}`;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text"><Key size={20} /></span>
        <div>
          <h2 className="font-semibold">Save your recovery key</h2>
          <p className="text-sm text-ink-2">It&apos;s the only way to reset a forgotten password from the sign-in screen. Keep it somewhere safe, like a password manager. It won&apos;t be shown again.</p>
        </div>
      </div>
      <p className="select-all break-all rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-center font-mono text-lg tracking-wider">{recoveryKey}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => navigator.clipboard?.writeText(recoveryKey).then(() => setCopied(true))} className="btn btn-ghost">
          {copied ? <Check size={16} weight="bold" /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
        </button>
        <a href={file} download="personalhq-recovery-key.txt" className="btn btn-ghost"><DownloadSimple size={16} /> Download</a>
      </div>
      {next && (
        <>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="accent-accent" />
            I&apos;ve saved my recovery key
          </label>
          {saved ? (
            <Link href={next} className="btn btn-primary w-full">{nextLabel}</Link>
          ) : (
            <button disabled className="btn btn-primary w-full">{nextLabel}</button>
          )}
        </>
      )}
    </div>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotAction, {});
  if (state.recoveryKey)
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm text-income">Password changed. Every other device has been signed out, AI-assistant access was revoked, and your old recovery key no longer works.</p>
        <RecoveryKeyNotice recoveryKey={state.recoveryKey} next="/" nextLabel="Open my dashboard" />
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" name="username" defaultValue={state.values?.username} required autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} className="input" autoComplete="username" />
      </div>
      <div>
        <label className="label" htmlFor="recoveryKey">Recovery key</label>
        <input id="recoveryKey" name="recoveryKey" defaultValue={state.values?.recoveryKey} required autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" className="input font-mono" autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input id="password" name="password" type="password" required minLength={10} className="input" autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm</label>
          <input id="confirm" name="confirm" type="password" required minLength={10} className="input" autoComplete="new-password" />
        </div>
      </div>
      <Err error={state.error} />
      <button disabled={pending} className="btn btn-primary w-full">{pending ? "Resetting…" : "Reset password"}</button>
    </form>
  );
}

// Older installs: choose a username, then save the recovery key.
export function SecureAccountForm() {
  const [state, action, pending] = useActionState(completeAccountAction, {});
  if (state.recoveryKey) return <RecoveryKeyNotice recoveryKey={state.recoveryKey} next="/" nextLabel="Open my dashboard" />;
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">Choose a username</label>
        <input id="username" name="username" defaultValue={state.values?.username} required minLength={3} maxLength={32} autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} className="input" autoComplete="username" />
        <p className="mt-1.5 text-xs text-ink-3">You&apos;ll sign in with it from now on. Letters, numbers, dots, dashes or underscores.</p>
      </div>
      <Err error={state.error} />
      <button disabled={pending} className="btn btn-primary w-full">{pending ? "Saving…" : "Continue"}</button>
    </form>
  );
}

// ---------- Settings › Profile ----------

export function UsernameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(usernameAction, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <label className="label" htmlFor="new-username">Username</label>
        <input id="new-username" name="username" defaultValue={state.values?.username ?? current} required autoCapitalize="none" autoCorrect="off" spellCheck={false} className="input" autoComplete="username" />
      </div>
      <div>
        <label className="label" htmlFor="username-password">Current password</label>
        <input id="username-password" name="password" type="password" required className="input" autoComplete="current-password" />
      </div>
      <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Change"}</button>
      <div className="empty:hidden sm:col-span-3">
        <Err error={state.error} />
        {state.ok && <p role="status" className="text-sm text-income">Username changed.</p>}
      </div>
    </form>
  );
}

export function RecoveryKeyForm() {
  const [state, action, pending] = useActionState(recoveryKeyAction, {});
  if (state.recoveryKey) return <RecoveryKeyNotice recoveryKey={state.recoveryKey} />;
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-ink-2">Lost it, or worried someone saw it? Make a new one — the old key stops working.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="recovery-password">Current password</label>
          <input id="recovery-password" name="password" type="password" required className="input" autoComplete="current-password" />
        </div>
        <button disabled={pending} className="btn btn-ghost">{pending ? "Making…" : "New recovery key"}</button>
      </div>
      <Err error={state.error} />
    </form>
  );
}
