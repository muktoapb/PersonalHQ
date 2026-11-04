import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { oauthClients, oauthCodes, oauthTokens } from "@/db/schema";
import type { Result } from "@/lib/core/result";

// OAuth 2.1 for the MCP endpoint, as MCP clients (Claude's connectors and
// others) expect: dynamic client registration, authorization code + PKCE
// (S256 only), short-lived access tokens and rotating refresh tokens.
// Approving a client needs the owner's password (see app/oauth/authorize).

const CODE_TTL = 5 * 60_000;
const ACCESS_TTL = 60 * 60_000;
const REFRESH_TTL = 30 * 24 * 60 * 60_000;
const MAX_CLIENTS = 100;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const token = (prefix: string) => `${prefix}_${randomBytes(32).toString("base64url")}`;
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// ---------- registration (RFC 7591) ----------

// Web apps: https. Apps on this computer: http on a loopback address. Native
// apps: their own scheme (cursor://…), but never one a browser would run.
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "about:", "blob:"]);
function redirectOk(uri: string) {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "http:") return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    return !BLOCKED_SCHEMES.has(u.protocol);
  } catch {
    return false;
  }
}

const registration = z.object({
  redirect_uris: z.array(z.string().max(500).refine(redirectOk, "Unsupported redirect URI")).min(1).max(5),
  client_name: z.string().trim().max(100).optional(),
  token_endpoint_auth_method: z.enum(["none", "client_secret_post", "client_secret_basic"]).default("client_secret_basic"),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

export type RegisterError = { error: "invalid_client_metadata" | "invalid_redirect_uri" | "temporarily_unavailable"; error_description: string };

export async function registerClient(input: unknown): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; body: RegisterError }> {
  const parsed = registration.safeParse(input);
  if (!parsed.success) {
    const redirect = parsed.error.issues.some((i) => i.path[0] === "redirect_uris");
    return { ok: false, body: { error: redirect ? "invalid_redirect_uri" : "invalid_client_metadata", error_description: parsed.error.issues[0].message } };
  }
  const m = parsed.data;
  if (m.grant_types?.some((g) => g !== "authorization_code" && g !== "refresh_token") || m.response_types?.some((r) => r !== "code"))
    return { ok: false, body: { error: "invalid_client_metadata", error_description: "Only the authorization code flow is supported." } };

  // Registration is open, so tidy up clients nobody approved within a day and cap the rest.
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  await db.delete(oauthClients).where(and(isNull(oauthClients.approvedAt), lt(oauthClients.createdAt, dayAgo)));
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(oauthClients);
  if (n >= MAX_CLIENTS) return { ok: false, body: { error: "temporarily_unavailable", error_description: "Too many registered apps. Disconnect some in Settings › MCP." } };

  const secret = m.token_endpoint_auth_method === "none" ? null : token("pcs");
  const [c] = await db
    .insert(oauthClients)
    .values({ name: m.client_name || "AI app", redirectUris: m.redirect_uris, secretHash: secret && sha(secret) })
    .returning();
  return {
    ok: true,
    body: {
      client_id: c.id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: c.name,
      redirect_uris: c.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: m.token_endpoint_auth_method,
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    },
  };
}

// ---------- authorization ----------

export type AuthorizeRequest = {
  client: { id: string; name: string };
  redirectUri: string;
  challenge: string;
  state: string | null;
};

// Checks an authorization request. `fatal` errors (unknown app, wrong
// redirect address) are shown on the page; the rest go back to the app.
export async function checkAuthorize(p: Record<string, string | undefined>, resource: string):
  Promise<{ ok: true; req: AuthorizeRequest } | { ok: false; fatal: string } | { ok: false; redirect: string }> {
  const client = p.client_id ? (await db.select().from(oauthClients).where(eq(oauthClients.id, p.client_id)))[0] : undefined;
  if (!client) return { ok: false, fatal: "This app isn't registered with your dashboard. Try connecting it again." };
  const redirectUri = p.redirect_uri ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : "");
  if (!client.redirectUris.includes(redirectUri)) return { ok: false, fatal: "This app asked to return to an address it didn't register." };

  const back = (error: string, description: string) => {
    const u = new URL(redirectUri);
    u.searchParams.set("error", error);
    u.searchParams.set("error_description", description);
    if (p.state) u.searchParams.set("state", p.state);
    return { ok: false as const, redirect: u.toString() };
  };
  if (p.response_type !== "code") return back("unsupported_response_type", "Only response_type=code is supported.");
  if (!p.code_challenge || p.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(p.code_challenge))
    return back("invalid_request", "PKCE with S256 is required.");
  if (p.resource && p.resource.replace(/\/$/, "") !== resource) return back("invalid_target", "Unknown resource.");
  return { ok: true, req: { client: { id: client.id, name: client.name }, redirectUri, challenge: p.code_challenge, state: p.state ?? null } };
}

// The owner approved: a one-time code for the app to swap for tokens.
export async function issueCode(req: AuthorizeRequest) {
  const code = token("pco");
  await db.batch([
    db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, Date.now())),
    db.insert(oauthCodes).values({ hash: sha(code), clientId: req.client.id, redirectUri: req.redirectUri, challenge: req.challenge, expiresAt: Date.now() + CODE_TTL }),
    db.update(oauthClients).set({ approvedAt: sql`coalesce(${oauthClients.approvedAt}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` }).where(eq(oauthClients.id, req.client.id)),
  ]);
  return code;
}

// ---------- token endpoint ----------

export type TokenError = { error: "invalid_request" | "invalid_client" | "invalid_grant" | "unsupported_grant_type"; error_description: string };
type Tokens = { access_token: string; token_type: "Bearer"; expires_in: number; refresh_token: string; scope: string };

// Public clients prove nothing here (PKCE does that); confidential ones must
// send their secret (client_secret_basic or client_secret_post).
async function authenticateClient(clientId: string | undefined, secret: string | undefined) {
  if (!clientId) return null;
  const [c] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId));
  if (!c) return null;
  if (c.secretHash && !(secret && sameHash(sha(secret), c.secretHash))) return null;
  return c;
}

const newTokens = () => {
  const access = token("pat"), refresh = token("prt");
  const now = Date.now();
  return {
    reply: { access_token: access, token_type: "Bearer" as const, expires_in: ACCESS_TTL / 1000, refresh_token: refresh, scope: "mcp" },
    row: { accessHash: sha(access), accessExpiresAt: now + ACCESS_TTL, refreshHash: sha(refresh), refreshExpiresAt: now + REFRESH_TTL },
  };
};

export async function exchangeToken(f: Record<string, string | undefined>): Promise<Result<{ tokens: Tokens }> | (TokenError & { ok: false })> {
  const err = (error: TokenError["error"], error_description: string) => ({ ok: false as const, error, error_description });
  const client = await authenticateClient(f.client_id, f.client_secret);
  if (!client) return err("invalid_client", "Unknown app or wrong secret.");

  if (f.grant_type === "authorization_code") {
    if (!f.code || !f.code_verifier) return err("invalid_request", "code and code_verifier are required.");
    // Single use: the code is deleted whatever happens next.
    const [code] = await db.delete(oauthCodes).where(eq(oauthCodes.hash, sha(f.code))).returning();
    if (!code || code.clientId !== client.id || code.expiresAt < Date.now()) return err("invalid_grant", "The code is invalid or has expired.");
    if (f.redirect_uri && f.redirect_uri !== code.redirectUri) return err("invalid_grant", "redirect_uri doesn't match.");
    const challenge = createHash("sha256").update(f.code_verifier).digest("base64url");
    if (!sameHash(challenge, code.challenge)) return err("invalid_grant", "PKCE verification failed.");
    const t = newTokens();
    await db.insert(oauthTokens).values({ clientId: client.id, ...t.row });
    return { ok: true, tokens: t.reply };
  }

  if (f.grant_type === "refresh_token") {
    if (!f.refresh_token) return err("invalid_request", "refresh_token is required.");
    const [row] = await db.select().from(oauthTokens).where(and(eq(oauthTokens.refreshHash, sha(f.refresh_token)), gt(oauthTokens.refreshExpiresAt, Date.now())));
    if (!row || row.clientId !== client.id) return err("invalid_grant", "The refresh token is invalid or has expired.");
    // Rotate: the old refresh token stops working.
    const t = newTokens();
    await db.update(oauthTokens).set(t.row).where(eq(oauthTokens.id, row.id));
    return { ok: true, tokens: t.reply };
  }
  return err("unsupported_grant_type", "Use authorization_code or refresh_token.");
}

// ---------- using and managing access ----------

export async function verifyAccessToken(value: string) {
  const [row] = await db.select().from(oauthTokens).where(and(eq(oauthTokens.accessHash, sha(value)), gt(oauthTokens.accessExpiresAt, Date.now())));
  if (!row) return false;
  // Remember when it was last used (at most every few minutes).
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt > 5 * 60_000)
    await db.update(oauthTokens).set({ lastUsedAt: Date.now() }).where(eq(oauthTokens.id, row.id));
  return true;
}

export type Connection = { id: string; name: string; approvedAt: string; lastUsedAt: number | null; redirectHost: string };

// Approved apps that still hold a usable refresh token.
export async function listConnections(): Promise<Connection[]> {
  const rows = await db
    .select({
      id: oauthClients.id,
      name: oauthClients.name,
      approvedAt: oauthClients.approvedAt,
      redirectUris: oauthClients.redirectUris,
      lastUsedAt: sql<number | null>`max(${oauthTokens.lastUsedAt})`,
    })
    .from(oauthClients)
    .innerJoin(oauthTokens, eq(oauthTokens.clientId, oauthClients.id))
    .where(gt(oauthTokens.refreshExpiresAt, Date.now()))
    .groupBy(oauthClients.id);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    approvedAt: r.approvedAt ?? "",
    lastUsedAt: r.lastUsedAt,
    redirectHost: (() => { try { return new URL(r.redirectUris[0]).host || r.redirectUris[0]; } catch { return ""; } })(),
  }));
}

export async function disconnect(clientId: string) {
  await db.batch([
    db.delete(oauthTokens).where(eq(oauthTokens.clientId, clientId)),
    db.delete(oauthCodes).where(eq(oauthCodes.clientId, clientId)),
    db.delete(oauthClients).where(eq(oauthClients.id, clientId)),
  ]);
}

// After a password reset: every connected app must sign in again.
export const revokeAllStatements = () => [db.delete(oauthTokens), db.delete(oauthCodes), db.delete(oauthClients)] as const;
