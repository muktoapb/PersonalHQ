"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientKey, endSession, hasValidSession, isUnlocked, lockNow, requireSession, unlockedUntil, unlockFor } from "@/lib/auth";
import { clearFailures, lockedFor, recordFailure, removePin, setLockMinutes, setPin, verifyPin } from "@/lib/core/account";
import { getSettings } from "@/lib/core/settings";

export type LockState = { error?: string; ok?: boolean };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
// Only paths inside this app (no "//host" or "/\host" tricks).
const safeNext = (next: string) => (/^\/(?![/\\])/.test(next) ? next : "/");

// The lock screen: right PIN -> back where you were. Wrong guesses count
// toward the same lockout as sign-in.
export async function unlockAction(_: LockState, fd: FormData): Promise<LockState> {
  const s = await getSettings();
  if (!s || !(await hasValidSession())) redirect("/login");
  if (!s.pinHash) redirect(safeNext(str(fd, "next")));
  const key = await clientKey();
  const locked = await lockedFor(key);
  if (locked) return { error: `Too many attempts. Try again in ${locked} minute${locked === 1 ? "" : "s"}.` };
  if (!(await verifyPin(str(fd, "pin")))) {
    await recordFailure(key);
    await new Promise((r) => setTimeout(r, 400));
    const now = await lockedFor(key);
    return { error: now ? `Too many attempts. Try again in ${now} minutes.` : "Wrong PIN." };
  }
  await clearFailures(key);
  await unlockFor(s.sessionSecret, s.pinLockMinutes);
  redirect(safeNext(str(fd, "next")));
}

// Forgot the PIN: sign out and sign in with the password instead.
export async function usePasswordAction() {
  await endSession();
  redirect("/login");
}

// While the app is in use, keep it unlocked for another lock period.
// Returns when it will lock (null: no PIN), or that it already has.
export async function keepUnlockedAction(): Promise<{ until: number | null } | { locked: true }> {
  const s = await getSettings();
  if (!s || !s.pinHash) return { until: null };
  if (!(await hasValidSession()) || !(await isUnlocked(s))) return { locked: true };
  return { until: await unlockFor(s.sessionSecret, s.pinLockMinutes) };
}

// Is it still unlocked (another tab may have kept it so)? Doesn't extend it.
export async function lockStatusAction(): Promise<{ until: number | null } | { locked: true }> {
  const s = await getSettings();
  if (!s || !s.pinHash) return { until: null };
  const until = (await hasValidSession()) ? await unlockedUntil(s.sessionSecret) : null;
  return until === null ? { locked: true } : { until };
}

export async function lockNowAction() {
  await requireSession();
  await lockNow();
  redirect("/unlock");
}

export async function setPinAction(_: LockState, fd: FormData): Promise<LockState> {
  const s = await requireSession();
  if (str(fd, "pin") !== str(fd, "confirm")) return { error: "PINs don't match." };
  const res = await setPin(str(fd, "password"), str(fd, "pin"));
  if (!res.ok) return { error: res.error };
  await unlockFor(s.sessionSecret, s.pinLockMinutes); // don't lock straight away
  revalidatePath("/settings/profile");
  return { ok: true };
}

export async function removePinAction(_: LockState, fd: FormData): Promise<LockState> {
  await requireSession();
  const res = await removePin(str(fd, "password"));
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function lockMinutesAction(minutes: number): Promise<LockState> {
  const s = await requireSession();
  const res = await setLockMinutes(minutes);
  if (!res.ok) return { error: res.error };
  await unlockFor(s.sessionSecret, minutes);
  revalidatePath("/", "layout");
  return { ok: true };
}
