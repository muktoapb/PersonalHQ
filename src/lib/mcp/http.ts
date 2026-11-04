// Shared HTTP bits for the MCP and OAuth endpoints. They use bearer tokens,
// never cookies, so any origin may call them (browser-based MCP clients).
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

export const preflight = () => new Response(null, { status: 204, headers: CORS });

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store", ...headers } });

// Form posts (the OAuth standard) or JSON, as a flat string map.
export async function readParams(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = await req.json();
      return Object.fromEntries(Object.entries(body ?? {}).filter(([, v]) => typeof v === "string")) as Record<string, string>;
    }
    return Object.fromEntries(new URLSearchParams(await req.text()));
  } catch {
    return {};
  }
}
