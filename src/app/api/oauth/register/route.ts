import { json, preflight } from "@/lib/mcp/http";
import { registerClient } from "@/lib/mcp/oauth";

// Dynamic client registration: MCP clients sign themselves up. Registering
// grants nothing; the owner still has to approve the app with their password.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_client_metadata", error_description: "Send the client metadata as JSON." }, 400);
  }
  const r = await registerClient(body);
  return json(r.body, r.ok ? 201 : 400);
}
export const OPTIONS = preflight;
