import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/core/settings";

// Single-user auth: one password (hashed in settings) and a signed session
// cookie. Changing the password rotates sessionSecret, signing out everywhere.

const COOKIE = "pd_session";
const SESSION_DAYS = 30;

const sign = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("base64url");

export async function startSession(sessionSecret: string) {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const value = `${expires}.${sign(String(expires), sessionSecret)}`;
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function hasValidSession(): Promise<boolean> {
  const settings = await getSettings();
  if (!settings) return false;
  const raw = (await cookies()).get(COOKIE)?.value ?? "";
  const [expires, mac] = raw.split(".");
  if (!expires || !mac || Number(expires) < Date.now()) return false;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(expires, settings.sessionSecret));
  return a.length === b.length && timingSafeEqual(a, b);
}

// Gate for every page and server action: not set up -> /setup, signed out ->
// /login, an install from before usernames -> /secure-account (pick a
// username, save a recovery key) before anything else.
export async function requireSession() {
  const settings = await getSettings();
  if (!settings) redirect("/setup");
  if (!(await hasValidSession())) redirect("/login");
  if (!settings.username || !settings.recoveryHash) redirect("/secure-account");
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
