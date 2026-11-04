"use client";

import { useActionState } from "react";
import { consentAction } from "@/lib/actions/oauth";

// The approval form for an app asking for MCP access. Signed in: just the
// password. Otherwise: username and password.
export function OAuthConsent({ params, signedIn }: { params: Record<string, string>; signedIn: boolean }) {
  const [state, action, pending] = useActionState(consentAction, {});
  return (
    <form action={action} className="space-y-4">
      {Object.entries(params).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {!signedIn && (
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input id="username" name="username" defaultValue={state.username} required autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} className="input" autoComplete="username" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="password">{signedIn ? "Confirm with your password" : "Password"}</label>
        <input id="password" name="password" type="password" required autoFocus={signedIn} className="input" autoComplete="current-password" />
      </div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button name="decision" value="deny" formNoValidate disabled={pending} className="btn btn-ghost flex-1">Deny</button>
        <button name="decision" value="allow" disabled={pending} className="btn btn-primary flex-1">{pending ? "Checking…" : "Allow"}</button>
      </div>
    </form>
  );
}
