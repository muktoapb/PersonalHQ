import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { getSettings } from "@/lib/core/settings";
import { newSecret } from "@/lib/secrets";

// One access token for AI assistants. Only its SHA-256 is stored (the token
// is 256 random bits, so a fast hash is enough); it is shown once on creation.

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
  const stored = (await getSettings())?.mcpTokenHash;
  if (!token || !stored) return false;
  const a = Buffer.from(hash(token));
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
