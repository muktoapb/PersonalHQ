import { CORS, json, preflight } from "@/lib/mcp/http";
import { publicOrigin } from "@/lib/origin";

// RFC 8414: where MCP clients register, send the owner to approve, and get tokens.
export function GET(req: Request) {
  const o = publicOrigin(req.headers);
  return json(
    {
      issuer: o,
      authorization_endpoint: `${o}/oauth/authorize`,
      token_endpoint: `${o}/api/oauth/token`,
      registration_endpoint: `${o}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
      scopes_supported: ["mcp"],
    },
    200,
    { ...CORS, "Cache-Control": "public, max-age=3600" },
  );
}
export const OPTIONS = preflight;
