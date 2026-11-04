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

// Browsers send Origin; only this site may call (guards DNS rebinding).
// Desktop/CLI clients send none.
function badOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export async function POST(req: Request) {
  if (badOrigin(req)) return new Response("Forbidden origin", { status: 403 });
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
