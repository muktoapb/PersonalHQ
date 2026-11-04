import "server-only";
import { z } from "zod";
import { financeTools } from "./tools/finance";
import { noteTools } from "./tools/notes";
import { isFail, type Tool } from "./tools/shared";
import { taskTools } from "./tools/tasks";
import { trackerTools } from "./tools/trackers";

// A stateless MCP server over Streamable HTTP: each POST carries one JSON-RPC
// message (or a batch) and gets a JSON reply. Only tools are offered.

export const TOOL_AREAS: Record<string, Tool[]> = { Tasks: taskTools, Notes: noteTools, Trackers: trackerTools, Finance: financeTools };
const TOOLS = Object.values(TOOL_AREAS).flat();
const byName = new Map(TOOLS.map((t) => [t.name, t]));

// Newest first; a client asking for one of these gets it echoed back.
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

const INSTRUCTIONS =
  "Personal dashboard: tasks (in groups, with subtasks), Keep-style notes, trackers (habits, amounts, readings, days-since, mood) and finance (income, expenses, investments, donations). " +
  "Look ids up with the list_* tools before writing. Dates are YYYY-MM-DD.";

type Message = { jsonrpc?: unknown; id?: string | number | null; method?: unknown; params?: Record<string, unknown> };
type Reply = { jsonrpc: "2.0"; id: string | number | null } & ({ result: unknown } | { error: { code: number; message: string } });

const ok = (id: Reply["id"], result: unknown): Reply => ({ jsonrpc: "2.0", id, result });
const err = (id: Reply["id"], code: number, message: string): Reply => ({ jsonrpc: "2.0", id, error: { code, message } });
const text = (data: unknown, isError = false) => ({ content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 1) }], isError });

async function callTool(params: Record<string, unknown> | undefined) {
  const t = byName.get(String(params?.name));
  if (!t) return null;
  const args = t.input.safeParse(params?.arguments ?? {});
  if (!args.success) return { ...text(`Invalid arguments: ${z.prettifyError(args.error)}`, true), write: false };
  try {
    const result = await t.run(args.data as never);
    if (isFail(result)) return { ...text(result.error, true), write: false };
    return { ...text(result ?? { ok: true }), write: !!t.write };
  } catch (e) {
    console.error(`[mcp] ${t.name}`, e);
    return { ...text("The tool failed on the server.", true), write: false };
  }
}

// Handles one message. Notifications (no id) get no reply. `wrote` reports
// whether a tool changed data, so the caller can refresh pages.
export async function handle(m: Message): Promise<{ reply: Reply | null; wrote: boolean }> {
  const id = m.id ?? null;
  const isRequest = m.id !== undefined && typeof m.method === "string";
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string") {
    // Responses from the client (we never send requests) are ignored.
    return { reply: m.method === undefined && m.id !== undefined ? null : err(id, -32600, "Invalid request"), wrote: false };
  }
  if (!isRequest) return { reply: null, wrote: false };

  switch (m.method) {
    case "initialize": {
      const asked = String(m.params?.protocolVersion ?? "");
      return {
        reply: ok(id, {
          protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "personalhq", title: "PersonalHQ", version: "0.1.0" },
          instructions: INSTRUCTIONS,
        }),
        wrote: false,
      };
    }
    case "ping":
      return { reply: ok(id, {}), wrote: false };
    case "tools/list":
      return {
        reply: ok(id, {
          tools: TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: z.toJSONSchema(t.input, { io: "input" }),
            annotations: { readOnlyHint: !t.write, destructiveHint: t.name.startsWith("delete_"), openWorldHint: false },
          })),
        }),
        wrote: false,
      };
    case "tools/call": {
      const r = await callTool(m.params);
      if (!r) return { reply: err(id, -32602, `Unknown tool: ${String(m.params?.name)}`), wrote: false };
      const { write, ...result } = r;
      return { reply: ok(id, result), wrote: write };
    }
    default:
      return { reply: err(id, -32601, `Method not found: ${m.method}`), wrote: false };
  }
}
