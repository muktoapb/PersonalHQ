import { CORS, json, preflight } from "@/lib/mcp/http";
import { mcpUrl, publicOrigin } from "@/lib/origin";

// RFC 9728: tells MCP clients which server issues tokens for /api/mcp.
// Served at the bare path and at /.well-known/oauth-protected-resource/api/mcp.
export function GET(req: Request) {
  return json(
    {
      resource: mcpUrl(req.headers),
      authorization_servers: [publicOrigin(req.headers)],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp"],
      resource_name: "PersonalHQ",
    },
    200,
    { ...CORS, "Cache-Control": "public, max-age=3600" },
  );
}
export const OPTIONS = preflight;
