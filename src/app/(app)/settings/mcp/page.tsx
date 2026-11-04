import { headers } from "next/headers";
import { McpAccess } from "@/components/SettingsForms";
import { requireSession } from "@/lib/auth";
import { promptPrefs } from "@/lib/mcp/prompt";
import { TOOL_AREAS } from "@/lib/mcp/server";

export const metadata = { title: "MCP · Settings" };

export default async function McpSettings() {
  const s = await requireSession();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return (
    <>
      <h1 className="text-3xl font-semibold">MCP</h1>
      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold">AI assistant access</h2>
          <p className="text-sm text-ink-2">Let Claude and other MCP clients read and update your dashboard with a private access token.</p>
        </div>
        <McpAccess endpoint={`${proto}://${host}/api/mcp`} hasToken={!!s.mcpTokenHash} prefs={promptPrefs(s)} />
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
