import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { loginAttempts, settings } from "@/db/schema";
import { hashSecret, newSecret, verifySecret } from "@/lib/secrets";
import { checkPassword, hashKey, newRecoveryKey, normalizeKey, usernameSchema } from "./credentials";
import { getSettings } from "./settings";
import { type Result, fail } from "./result";

// Signing in, recovery keys (the self-hosted stand-in for "email me a reset
// link"), username/key changes, and lockouts after repeated failures.

// ---------- lockouts ----------

const FREE_TRIES = 5;
const BASE_LOCK_MS = 60_000; // after 5 failures: 1 min, then 2, 4… up to an hour
const MAX_LOCK_MS = 3_600_000;
const FORGET_AFTER_MS = 24 * 3_600_000; // a quiet day wipes the slate

// Minutes left on a lockout for this client, or 0.
export async function lockedFor(key: string): Promise<number> {
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key));
  const left = (row?.lockedUntil ?? 0) - Date.now();
  return left > 0 ? Math.ceil(left / 60_000) : 0;
}

export async function recordFailure(key: string) {
  const now = Date.now();
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key));
  const failures = (row && now - row.updatedAt < FORGET_AFTER_MS ? row.failures : 0) + 1;
  const lockedUntil = failures >= FREE_TRIES ? now + Math.min(BASE_LOCK_MS * 2 ** (failures - FREE_TRIES), MAX_LOCK_MS) : 0;
  await db
    .insert(loginAttempts)
    .values({ key, failures, lockedUntil, updatedAt: now })
    .onConflictDoUpdate({ target: loginAttempts.key, set: { failures, lockedUntil, updatedAt: now } });
}

export const clearFailures = (key: string) => db.delete(loginAttempts).where(eq(loginAttempts.key, key));

// ---------- sign-in and recovery ----------

// The password is always checked, even for a wrong username, so the two
// cases take the same time and give the same answer.
export async function verifyLogin(username: string, password: string): Promise<boolean> {
  const s = await getSettings();
  if (!s) return false;
  const passwordOk = await verifySecret(password, s.passwordHash);
  const nameOk = s.username === null || s.username === username.trim().toLowerCase();
  return passwordOk && nameOk;
}

export const RECOVERY_MISMATCH = "That username and recovery key don't match.";

// Forgot password: username + recovery key -> new password. Signs out every
// device and replaces the key (it has now been used).
export async function resetWithRecoveryKey(
  username: string,
  key: string,
  password: string,
): Promise<Result<{ sessionSecret: string; recoveryKey: string }>> {
  const s = await getSettings();
  const keyOk = await verifySecret(normalizeKey(key), s?.recoveryHash);
  if (!s || !keyOk || s.username !== username.trim().toLowerCase()) return fail(RECOVERY_MISMATCH);
  const bad = checkPassword(password, s.username);
  if (bad) return fail(bad);
  const sessionSecret = newSecret();
  const recoveryKey = newRecoveryKey();
  await db
    .update(settings)
    // a reset may follow a compromise: also revoke AI-assistant access
    .set({ passwordHash: await hashSecret(password), sessionSecret, recoveryHash: await hashKey(recoveryKey), mcpTokenHash: null })
    .where(eq(settings.id, 1));
  return { ok: true, sessionSecret, recoveryKey };
}

// Pick a username and get a recovery key (installs from before usernames).
// Only while the account has no username or recovery key: once set, changing
// them needs the password (changeUsername / regenerateRecoveryKey).
export async function completeAccount(input: { username: string }): Promise<Result<{ recoveryKey: string }>> {
  const s = await getSettings();
  if (!s) return fail("Not set up yet.");
  if (s.username && s.recoveryHash) return fail("Your account is already set up.");
  const u = usernameSchema.safeParse(input.username);
  if (!u.success) return fail(u.error.issues[0].message);
  const recoveryKey = newRecoveryKey();
  await db.update(settings).set({ username: u.data, recoveryHash: await hashKey(recoveryKey) }).where(eq(settings.id, 1));
  return { ok: true, recoveryKey };
}

// Changes that need the current password.
async function confirmPassword(password: string) {
  const s = await getSettings();
  return s && (await verifySecret(password, s.passwordHash)) ? s : null;
}

export async function changeUsername(password: string, username: string): Promise<Result> {
  if (!(await confirmPassword(password))) return fail("Password is wrong.");
  const u = usernameSchema.safeParse(username);
  if (!u.success) return fail(u.error.issues[0].message);
  await db.update(settings).set({ username: u.data }).where(eq(settings.id, 1));
  return { ok: true };
}

export async function regenerateRecoveryKey(password: string): Promise<Result<{ recoveryKey: string }>> {
  if (!(await confirmPassword(password))) return fail("Password is wrong.");
  const recoveryKey = newRecoveryKey();
  await db.update(settings).set({ recoveryHash: await hashKey(recoveryKey) }).where(eq(settings.id, 1));
  return { ok: true, recoveryKey };
}

