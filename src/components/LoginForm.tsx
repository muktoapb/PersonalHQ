"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";

// `withUsername` is false only on installs from before usernames.
export function LoginForm({ withUsername = true }: { withUsername?: boolean }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      {withUsername && (
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input id="username" name="username" defaultValue={state.values?.username} required autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} className="input" autoComplete="username" />
        </div>
      )}
      <div>
        <div className="flex items-baseline justify-between">
          <label className="label" htmlFor="password">Password</label>
          {withUsername && <Link href="/forgot" className="text-xs text-accent-text hover:underline">Forgot password?</Link>}
        </div>
        <input id="password" name="password" type="password" required autoFocus={!withUsername} className="input" autoComplete="current-password" />
      </div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary w-full">{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
