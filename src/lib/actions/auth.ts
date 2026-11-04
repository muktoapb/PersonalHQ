"use server";

import { redirect } from "next/navigation";
import { clientKey, endSession, hasValidSession, requireSession, startSession } from "@/lib/auth";
import {
  changeUsername, clearFailures, completeAccount, RECOVERY_MISMATCH, lockedFor, recordFailure, regenerateRecoveryKey, resetWithRecoveryKey, verifyLogin,
} from "@/lib/core/account";
import { changePassword, completeSetup, getSettings, rotateSessionSecret, updatePreferences } from "@/lib/core/settings";
import { revalidatePath } from "next/cache";

// `values` echoes what was typed (never passwords) so a form that failed can
// refill itself: React resets a form's fields after its action runs.
export type FormState = { error?: string; ok?: boolean; values?: Record<string, string> };
// Flows that end by showing a new recovery key once.
export type KeyState = FormState & { recoveryKey?: string };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const on = (fd: FormData, k: string) => fd.get(k) === "on";

// First run takes a name, username and password (the look is saved by the
// form itself); currency and the rest start as defaults, changed in Settings.
export async function setupAction(_: KeyState, fd: FormData): Promise<KeyState> {
  const values = { displayName: str(fd, "displayName"), username: str(fd, "username") };
  if (str(fd, "password") !== str(fd, "confirm")) return { error: "Passwords don't match.", values };
  const res = await completeSetup({
    displayName: values.displayName,
    username: values.username,
    password: str(fd, "password"),
    currency: "USD",
    currencySymbol: "$",
    locale: "en-US",
    manageDonation: true,
    manageInvestment: true,
  });
  if (!res.ok) return { error: res.error, values };
  // Shown once; then they sign in. (No session here: setting the cookie would
  // refresh /setup, which redirects away before the key could be saved.)
  return { recoveryKey: res.recoveryKey };
}

const lockedMessage = (min: number) => `Too many attempts. Try again in ${min} minute${min === 1 ? "" : "s"}.`;

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const s = await getSettings();
  if (!s) redirect("/setup");
  const values = { username: str(fd, "username") };
  const key = await clientKey();
  const locked = await lockedFor(key);
  if (locked) return { error: lockedMessage(locked), values };
  if (!(await verifyLogin(values.username, str(fd, "password")))) {
    await recordFailure(key);
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    const now = await lockedFor(key);
    return { error: now ? lockedMessage(now) : s.username ? "Wrong username or password." : "Wrong password.", values };
  }
  await clearFailures(key);
  await startSession(s.sessionSecret);
  redirect("/");
}

// Forgot password: username + recovery key + new password.
export async function forgotAction(_: KeyState, fd: FormData): Promise<KeyState> {
  const values = { username: str(fd, "username"), recoveryKey: str(fd, "recoveryKey") };
  const key = await clientKey();
  const locked = await lockedFor(key);
  if (locked) return { error: lockedMessage(locked), values };
  if (str(fd, "password") !== str(fd, "confirm")) return { error: "New passwords don't match.", values };
  const res = await resetWithRecoveryKey(values.username, values.recoveryKey, str(fd, "password"));
  if (!res.ok) {
    if (res.error === RECOVERY_MISMATCH) { // a guess: count it
      await recordFailure(key);
      await new Promise((r) => setTimeout(r, 600));
    }
    return { error: res.error, values };
  }
  await clearFailures(key);
  await startSession(res.sessionSecret);
  return { recoveryKey: res.recoveryKey };
}

// Installs from before usernames: pick one and get a recovery key.
export async function completeAccountAction(_: KeyState, fd: FormData): Promise<KeyState> {
  if (!(await hasValidSession())) redirect("/login");
  const res = await completeAccount({ username: str(fd, "username") });
  if (!res.ok) return { error: res.error, values: { username: str(fd, "username") } };
  return { recoveryKey: res.recoveryKey };
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

// Each settings page saves only its own fields.
const savePrefs = async (patch: Record<string, unknown>): Promise<FormState> => {
  await requireSession();
  const res = await updatePreferences(patch);
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  return { ok: true };
};

export async function profileAction(_: FormState, fd: FormData): Promise<FormState> {
  return savePrefs({ displayName: str(fd, "displayName") || null, spaceName: str(fd, "spaceName") || null });
}

export async function financePrefsAction(_: FormState, fd: FormData): Promise<FormState> {
  return savePrefs({
    currency: str(fd, "currency"),
    currencySymbol: str(fd, "currencySymbol"),
    locale: str(fd, "locale") || "en-US",
    manageDonation: on(fd, "manageDonation"),
    manageInvestment: on(fd, "manageInvestment"),
  });
}

// Settings › Profile, or filled in from the browser the first time (TimeZoneSync).
export async function timeZoneAction(timeZone: string): Promise<FormState> {
  return savePrefs({ timeZone });
}

export async function weekStartAction(_: FormState, fd: FormData): Promise<FormState> {
  return savePrefs({ weekStart: Number(str(fd, "weekStart")) });
}

// Keeps this device signed in with a fresh session.
export async function signOutOthersAction(): Promise<FormState> {
  await requireSession();
  const res = await rotateSessionSecret();
  if (!res.ok) return { error: res.error };
  await startSession(res.sessionSecret);
  return { ok: true };
}

export async function usernameAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
  const res = await changeUsername(str(fd, "password"), str(fd, "username"));
  if (!res.ok) return { error: res.error, values: { username: str(fd, "username") } };
  revalidatePath("/settings/profile");
  return { ok: true };
}

export async function recoveryKeyAction(_: KeyState, fd: FormData): Promise<KeyState> {
  await requireSession();
  const res = await regenerateRecoveryKey(str(fd, "password"));
  return res.ok ? { recoveryKey: res.recoveryKey } : { error: res.error };
}

export async function passwordAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
  if (str(fd, "next") !== str(fd, "confirm")) return { error: "New passwords don't match." };
  const res = await changePassword(str(fd, "current"), str(fd, "next"));
  if (!res.ok) return { error: res.error };
  await startSession(res.sessionSecret); // keep this device signed in
  return { ok: true };
}
