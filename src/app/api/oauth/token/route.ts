import { json, preflight, readParams } from "@/lib/mcp/http";
import { exchangeToken } from "@/lib/mcp/oauth";

// Swaps an approval code (with its PKCE verifier) or a refresh token for new tokens.
export async function POST(req: Request) {
  const f = await readParams(req);
  // client_secret_basic: "Authorization: Basic base64(id:secret)"
  const basic = req.headers.get("authorization")?.match(/^Basic\s+(\S+)$/i)?.[1];
  if (basic) {
    const [id, secret] = Buffer.from(basic, "base64").toString().split(":").map(decodeURIComponent);
    f.client_id ??= id;
    f.client_secret ??= secret;
  }
  const r = await exchangeToken(f);
  if (!r.ok) {
    const { error, error_description } = r as { error: string; error_description: string };
    return json({ error, error_description }, error === "invalid_client" ? 401 : 400);
  }
  return json(r.tokens);
}
export const OPTIONS = preflight;
