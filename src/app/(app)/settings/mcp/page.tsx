import { headers } from "next/headers";
import { ConnectedApps, CopyBlock, McpAccess } from "@/components/SettingsForms";
import { requireSession } from "@/lib/auth";
import { listConnections } from "@/lib/mcp/oauth";
import { TOOL_AREAS } from "@/lib/mcp/server";
import { mcpUrl } from "@/lib/origin";

export const metadata = { title: "MCP · Settings" };

export default async function McpSettings() {
  const s = await requireSession();
  const endpoint = mcpUrl(await headers());
  const apps = await listConnections();
  return (
    <>
      <h1 className="text-3xl font-semibold">MCP</h1>
      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold">Connect with sign-in</h2>
          <p className="text-sm text-ink-2">
            For Claude (web, desktop and mobile) and other apps that support OAuth: add a custom connector with this URL. The app opens a
            PersonalHQ page where you approve it with your password.
          </p>
        </div>
        <CopyBlock label="Connector URL" value={endpoint} />
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Connected apps</h3>
          <ConnectedApps apps={apps} locale={s.locale} />
        </div>
      </section>
      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold">Access token</h2>
          <p className="text-sm text-ink-2">For Claude Code and clients that let you set a header: one private token, no sign-in page.</p>
        </div>
        <McpAccess endpoint={endpoint} hasToken={!!s.mcpTokenHash} />
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Tools <span className="font-normal text-ink-3">· {Object.values(TOOL_AREAS).flat().length}</span></h2>
        <dl className="space-y-3">
          {Object.entries(TOOL_AREAS).map(([label, tools]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-ink-3">{label}</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {tools.map((t) => (
                  <span key={t.name} title={t.description} className={`rounded-full border px-2.5 py-0.5 font-mono text-xs ${t.write ? "border-accent/40 text-accent-text" : "border-rule text-ink-2"}`}>{t.name}</span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-ink-3">Highlighted tools can change data; the rest only read.</p>
      </section>
    </>
  );
}
