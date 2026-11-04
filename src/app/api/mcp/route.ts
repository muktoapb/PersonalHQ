import { revalidatePath } from "next/cache";
import { verifyMcpToken } from "@/lib/mcp/auth";
import { CORS, preflight } from "@/lib/mcp/http";
import { handle } from "@/lib/mcp/server";
import { publicOrigin } from "@/lib/origin";

// MCP endpoint (Streamable HTTP, stateless, JSON replies). Authenticated with
// the token from Settings → MCP or an OAuth access token. A 401 points
// clients at the OAuth metadata, so apps like Claude can start sign-in.

const unauthorized = (req: Request) =>
  Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing or invalid token. Sign in, or create a token in Settings → MCP." } },
    {
      status: 401,
      headers: {
        ...CORS,
        "WWW-Authenticate": `Bearer realm="personalhq", resource_metadata="${publicOrigin(req.headers)}/.well-known/oauth-protected-resource/api/mcp"`,
      },
    },
  );

// No Origin check: hosted agents (Muse, web clients) send their own Origin,
// and every request needs the bearer token, which a web page can't know, so
// the token is what keeps other sites out (DNS rebinding included).
export async function POST(req: Request) {
  if (!(await verifyMcpToken(req.headers.get("authorization")))) return unauthorized(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: CORS });
  }
  const batch = Array.isArray(body);
  const messages = (batch ? body : [body]) as Parameters<typeof handle>[0][];
  const results = [];
  for (const m of messages) results.push(await handle(m && typeof m === "object" ? m : {}));
  if (results.some((r) => r.wrote)) revalidatePath("/", "layout");

  const replies = results.flatMap((r) => (r.reply ? [r.reply] : []));
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return Response.json(batch ? replies : replies[0], { headers: CORS });
}

// No server-initiated stream and no sessions.
export function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { ...CORS, Allow: "POST" } });
}
export const DELETE = GET;
export const OPTIONS = preflight;
