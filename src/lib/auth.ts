import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/core/settings";

// Single-user auth: one password (hashed in settings) and a signed session
// cookie. Changing the password rotates sessionSecret, signing out everywhere.
//
// Optional app lock: with a PIN set, a second short-lived cookie says "unlocked
// until …". It slides forward while the app is in use (AppLock pings) and,
// once it runs out, pages send you to /unlock for the PIN.

const COOKIE = "pd_session";
const UNLOCK = "pd_unlock";
const SESSION_DAYS = 30;

const sign = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("base64url");
// The unlock cookie is signed with a different key than the session, so one can't stand in for the other.
const unlockKey = (sessionSecret: string) => `${sessionSecret}:unlock`;

const cookieOptions = (expires: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires: new Date(expires),
});

const verify = (raw: string, key: string) => {
  const [expires, mac] = raw.split(".");
  if (!expires || !mac || Number(expires) < Date.now()) return false;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(expires, key));
  return a.length === b.length && timingSafeEqual(a, b);
};

// Signing in proves more than a PIN, so it also unlocks.
export async function startSession(sessionSecret: string) {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const jar = await cookies();
  jar.set(COOKIE, `${expires}.${sign(String(expires), sessionSecret)}`, cookieOptions(expires));
  await unlockFor(sessionSecret, (await getSettings())?.pinLockMinutes ?? 5);
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(UNLOCK);
}

// Unlocked for the next `minutes` (after the PIN, or while in use).
export async function unlockFor(sessionSecret: string, minutes: number) {
  const until = Date.now() + minutes * 60_000;
  (await cookies()).set(UNLOCK, `${until}.${sign(String(until), unlockKey(sessionSecret))}`, cookieOptions(until));
  return until;
}

export async function lockNow() {
  (await cookies()).delete(UNLOCK);
}

// When the app locks (epoch ms), or null if it's locked already.
export async function unlockedUntil(sessionSecret: string) {
  const raw = (await cookies()).get(UNLOCK)?.value ?? "";
  return verify(raw, unlockKey(sessionSecret)) ? Number(raw.split(".")[0]) : null;
}

// True when no PIN is set, or the unlock cookie is still good.
export async function isUnlocked(settings: { pinHash: string | null; sessionSecret: string }) {
  return !settings.pinHash || (await unlockedUntil(settings.sessionSecret)) !== null;
}

export async function hasValidSession(): Promise<boolean> {
  const settings = await getSettings();
  if (!settings) return false;
  return verify((await cookies()).get(COOKIE)?.value ?? "", settings.sessionSecret);
}

// Gate for every page and server action: not set up -> /setup, signed out ->
// /login, an install from before usernames -> /secure-account (pick a
// username, save a recovery key), locked by the app PIN -> /unlock.
export async function requireSession() {
  const settings = await getSettings();
  if (!settings) redirect("/setup");
  if (!(await hasValidSession())) redirect("/login");
  if (!settings.username || !settings.recoveryHash) redirect("/secure-account");
  if (!(await isUnlocked(settings))) redirect("/unlock");
  return settings;
}

// Who is knocking, for sign-in lockouts: the client address as reported by a
// reverse proxy, else one shared bucket. (Behind no proxy every client shares
// it, which still caps guessing.)
export async function clientKey() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "direct";
  return `ip:${ip}`;
}
