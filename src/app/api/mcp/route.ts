import { revalidatePath } from "next/cache";
import { verifyMcpToken } from "@/lib/mcp/auth";
import { handle } from "@/lib/mcp/server";

// MCP endpoint (Streamable HTTP, stateless, JSON replies). Authenticated with
// the bearer token from Settings → MCP.

const unauthorized = () =>
  Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing or invalid token. Create one in Settings → MCP." } },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="personalhq"' } },
  );

// No Origin check: hosted agents (Muse, web clients) send their own Origin,
// and every request needs the bearer token, which a web page can't know, so
// the token is what keeps other sites out (DNS rebinding included).
export async function POST(req: Request) {
  if (!(await verifyMcpToken(req.headers.get("authorization")))) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const batch = Array.isArray(body);
  const messages = (batch ? body : [body]) as Parameters<typeof handle>[0][];
  const results = [];
  for (const m of messages) results.push(await handle(m && typeof m === "object" ? m : {}));
  if (results.some((r) => r.wrote)) revalidatePath("/", "layout");

  const replies = results.flatMap((r) => (r.reply ? [r.reply] : []));
  if (!replies.length) return new Response(null, { status: 202 });
  return Response.json(batch ? replies : replies[0]);
}

// No server-initiated stream and no sessions.
export function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
export const DELETE = GET;
