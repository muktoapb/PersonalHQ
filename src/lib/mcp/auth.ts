import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { getSettings } from "@/lib/core/settings";
import { newSecret } from "@/lib/secrets";
import { verifyAccessToken } from "./oauth";

// Two ways in: the owner's own access token (Settings › MCP, for clients that
// take a header) or an OAuth access token (apps approved through sign-in,
// see ./oauth). The owner's token is shown once; only its SHA-256 is stored
// (it is 256 random bits, so a fast hash is enough).

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createMcpToken() {
  const token = `pd_${newSecret()}`;
  await db.update(settings).set({ mcpTokenHash: hash(token) }).where(eq(settings.id, 1));
  return token;
}

export async function revokeMcpToken() {
  await db.update(settings).set({ mcpTokenHash: null }).where(eq(settings.id, 1));
}

export async function verifyMcpToken(authorization: string | null) {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return false;
  if (token.startsWith("pat_")) return verifyAccessToken(token);
  const stored = (await getSettings())?.mcpTokenHash;
  if (!stored) return false;
  const a = Buffer.from(hash(token));
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
