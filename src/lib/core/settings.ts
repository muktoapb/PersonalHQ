import "server-only";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, settings, type TransactionKind } from "@/db/schema";
import { hashSecret, newSecret, verifySecret } from "@/lib/secrets";
import { checkPassword, hashKey, newRecoveryKey, usernameSchema } from "./credentials";
import { type Result, fail } from "./result";

// The single settings row, read per request. connection() keeps every page
// that depends on it dynamic: it must never be prerendered at build time.
export const getSettings = cache(async () => {
  await connection();
  return (await db.select().from(settings).where(eq(settings.id, 1)).limit(1))[0] ?? null;
});

const currency = z
  .string()
  .regex(/^[A-Za-z]{3}$/, "Use a 3-letter currency code, e.g. USD, BDT, MYR")
  .transform((c) => c.toUpperCase());

// Which optional kinds (investments, donations) get their own pages.
const trackShape = { manageDonation: z.boolean(), manageInvestment: z.boolean() };

export const setupSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name.").max(80),
  username: usernameSchema,
  password: z.string(),
  currency,
  currencySymbol: z.string().trim().max(4).optional().transform((v) => v || null),
  locale: z.string().trim().min(2).max(20).default("en-US"),
  ...trackShape,
});

// Any subset of preferences (each settings page saves its own); no defaults,
// so fields a page doesn't send are left alone.
export const preferencesSchema = z
  .object({
    displayName: z.string().trim().max(80).nullable(),
    spaceName: z.string().trim().max(40).nullable().transform((v) => v || null),
    currency,
    currencySymbol: z.string().trim().max(4).nullable().transform((v) => v || null),
    locale: z.string().trim().min(2).max(20),
    weekStart: z.union([z.literal(0), z.literal(1), z.literal(6)]),
    ...trackShape,
  })
  .partial();

const DEFAULT_CATEGORIES: { name: string; kind: TransactionKind; color: string }[] = [
  { name: "Salary", kind: "income", color: "#10b981" },
  { name: "Freelance", kind: "income", color: "#14b8a6" },
  { name: "Food", kind: "expense", color: "#f97316" },
  { name: "Transport", kind: "expense", color: "#eab308" },
  { name: "Bills", kind: "expense", color: "#ef4444" },
  { name: "Shopping", kind: "expense", color: "#ec4899" },
  { name: "Savings", kind: "investment", color: "#0ea5e9" },
  { name: "Charity", kind: "donation", color: "#8b5cf6" },
];

// First-run setup. Only ever succeeds once: the row id is fixed at 1. The
// recovery key is returned to show once; only its hash is kept.
export async function completeSetup(input: unknown): Promise<Result<{ sessionSecret: string; recoveryKey: string }>> {
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { password, ...prefs } = parsed.data;
  const bad = checkPassword(password, prefs.username);
  if (bad) return fail(bad);
  const sessionSecret = newSecret();
  const recoveryKey = newRecoveryKey();
  const res = await db
    .insert(settings)
    .values({ id: 1, ...prefs, passwordHash: await hashSecret(password), recoveryHash: await hashKey(recoveryKey), sessionSecret })
    .onConflictDoNothing();
  if (res.rowsAffected === 0) return fail("This dashboard is already set up.");
  await db.insert(categories).values(DEFAULT_CATEGORIES);
  return { ok: true, sessionSecret, recoveryKey };
}

export async function updatePreferences(input: unknown): Promise<Result> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  await db.update(settings).set(parsed.data).where(eq(settings.id, 1));
  return { ok: true };
}

// Signs out every other device: a new session secret invalidates their
// cookies; the caller starts a fresh session for this one.
export async function rotateSessionSecret(): Promise<Result<{ sessionSecret: string }>> {
  const sessionSecret = newSecret();
  await db.update(settings).set({ sessionSecret }).where(eq(settings.id, 1));
  return { ok: true, sessionSecret };
}

// Rotating the session secret signs out every other device.
export async function changePassword(current: string, next: string): Promise<Result<{ sessionSecret: string }>> {
  const s = await getSettings();
  if (!s || !(await verifySecret(current, s.passwordHash))) return fail("Current password is wrong.");
  const bad = checkPassword(next, s.username);
  if (bad) return fail(bad);
  const sessionSecret = newSecret();
  await db.update(settings).set({ passwordHash: await hashSecret(next), sessionSecret }).where(eq(settings.id, 1));
  return { ok: true, sessionSecret };
}
