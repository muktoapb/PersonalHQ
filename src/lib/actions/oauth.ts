"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clientKey, hasValidSession, requireSession } from "@/lib/auth";
import { clearFailures, lockedFor, recordFailure, verifyLogin } from "@/lib/core/account";
import { getSettings } from "@/lib/core/settings";
import { checkAuthorize, disconnect, issueCode } from "@/lib/mcp/oauth";
import { mcpUrl, publicOrigin } from "@/lib/origin";

export type ConsentState = { error?: string; username?: string };

const AUTH_PARAMS = ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state", "resource"] as const;

// Approve or deny an app asking for MCP access. Everything is checked again
// here (the form's hidden fields are only a copy of the request), and
// approving needs the password, with the same lockout as sign-in.
export async function consentAction(_: ConsentState, fd: FormData): Promise<ConsentState> {
  const h = await headers();
  const params = Object.fromEntries(AUTH_PARAMS.map((k) => [k, fd.get(k) ? String(fd.get(k)) : undefined]));
  const check = await checkAuthorize(params, mcpUrl(h));
  if (!check.ok) {
    if ("redirect" in check) redirect(check.redirect);
    return { error: check.fatal };
  }
  const { req } = check;
  const back = (extra: Record<string, string>) => {
    const u = new URL(req.redirectUri);
    for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
    if (req.state) u.searchParams.set("state", req.state);
    u.searchParams.set("iss", publicOrigin(h));
    return u.toString();
  };
  if (fd.get("decision") !== "allow") redirect(back({ error: "access_denied", error_description: "The owner declined." }));

  const key = await clientKey();
  const locked = await lockedFor(key);
  const typed = String(fd.get("username") ?? "");
  if (locked) return { error: `Too many attempts. Try again in ${locked} minute${locked === 1 ? "" : "s"}.`, username: typed };
  const s = await getSettings();
  const username = (await hasValidSession()) ? (s?.username ?? "") : typed;
  if (!(await verifyLogin(username, String(fd.get("password") ?? "")))) {
    await recordFailure(key);
    await new Promise((r) => setTimeout(r, 600));
    const now = await lockedFor(key);
    return { error: now ? `Too many attempts. Try again in ${now} minutes.` : "Wrong username or password.", username: typed };
  }
  await clearFailures(key);
  const code = await issueCode(req);
  redirect(back({ code }));
}

export async function disconnectAppAction(clientId: string) {
  await requireSession();
  await disconnect(clientId);
  revalidatePath("/settings/mcp");
}
