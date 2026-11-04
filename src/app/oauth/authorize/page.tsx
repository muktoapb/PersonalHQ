import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { OAuthConsent } from "@/components/OAuthConsent";
import { hasValidSession } from "@/lib/auth";
import { getSettings } from "@/lib/core/settings";
import { checkAuthorize } from "@/lib/mcp/oauth";
import { mcpUrl } from "@/lib/origin";

export const metadata = { title: "Connect an app" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// OAuth authorization endpoint: an AI app (e.g. a Claude connector) sends
// the owner here to approve access to the MCP tools.
export default async function AuthorizePage({ searchParams }: Props) {
  if (!(await getSettings())) redirect("/setup");
  const raw = await searchParams;
  const p = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const check = await checkAuthorize(p, mcpUrl(await headers()));
  if (!check.ok && "redirect" in check) redirect(check.redirect);

  let to = "";
  if (check.ok) try { to = new URL(check.req.redirectUri).host; } catch {}
  const params = Object.fromEntries(Object.entries(p).filter((e): e is [string, string] => typeof e[1] === "string"));
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <Logo size={56} />
      {check.ok ? (
        <>
          <h1 className="mt-5 text-2xl font-semibold">Connect {check.req.client.name}?</h1>
          <p className="mb-6 mt-2 text-sm text-ink-2">
            It will be able to <strong className="font-medium text-ink">read and change</strong> your tasks, notes, trackers and finances.
            {to && <> You&apos;ll be sent back to <span className="font-medium text-ink">{to}</span>.</>}
          </p>
          <div className="card"><OAuthConsent params={params} signedIn={await hasValidSession()} /></div>
          <p className="mt-4 text-center text-xs text-ink-3">Only allow apps you started connecting yourself. You can disconnect it any time in Settings › MCP.</p>
        </>
      ) : (
        <>
          <h1 className="mt-5 text-2xl font-semibold">Can&apos;t connect this app</h1>
          <p className="mt-2 text-sm text-ink-2">{check.fatal}</p>
        </>
      )}
    </main>
  );
}
