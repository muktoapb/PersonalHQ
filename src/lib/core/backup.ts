import "server-only";
import { eq, getTableColumns, type Table } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "@/db/client";
import {
  categories,
  labels,
  noteCategories,
  notes,
  settings,
  taskColumns,
  taskGroups,
  taskLabels,
  taskNotes,
  trackerEntries,
  trackers,
  tasks,
  transactions,
  walletTransfers,
  wallets,
} from "@/db/schema";
import { getSettings, preferencesSchema } from "./settings";
import { type Result, fail } from "./result";

// Whole-dashboard backup as one JSON file. Secrets (password, session secret,
// MCP token) are never exported; preferences are. Importing replaces
// everything in a single transaction, so a bad file changes nothing.

const FORMAT = "personal-dashboard-backup";
const VERSION = 1;

// Parents before children, so the insert order is valid.
const TABLES = {
  categories,
  wallets,
  transactions,
  walletTransfers,
  taskGroups,
  taskColumns,
  tasks,
  labels,
  taskLabels,
  taskNotes,
  noteCategories,
  notes,
  trackers,
  trackerEntries,
} satisfies Record<string, Table>;
type TableName = keyof typeof TABLES;

const PREF_KEYS = ["displayName", "spaceName", "currency", "currencySymbol", "locale", "weekStart", "manageDonation", "manageInvestment"] as const;

export async function exportAll() {
  const s = await getSettings();
  const names = Object.keys(TABLES) as TableName[];
  const rows = await Promise.all(names.map((n) => db.select().from(TABLES[n] as typeof categories)));
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    preferences: s ? Object.fromEntries(PREF_KEYS.map((k) => [k, s[k]])) : {},
    data: Object.fromEntries(names.map((n, i) => [n, rows[i]])),
  };
}

// Checks one row against the table's columns: only known keys are kept, each
// value must match its column's type, and required columns without a default
// must be present.
function cleanRow(table: Table, row: unknown, where: string): Record<string, unknown> | string {
  if (!row || typeof row !== "object" || Array.isArray(row)) return `${where}: not an object.`;
  const out: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(getTableColumns(table)) as [string, SQLiteColumn][]) {
    const v = (row as Record<string, unknown>)[key];
    if (v === undefined || v === null) {
      if (col.notNull && !col.hasDefault) return `${where}: "${key}" is missing.`;
      if (v === null && col.notNull) continue; // let the default fill it
      if (v === null) out[key] = null;
      continue;
    }
    const ok =
      col.dataType === "string" ? typeof v === "string" && (!col.enumValues?.length || col.enumValues.includes(v))
      : col.dataType === "number" ? typeof v === "number" && Number.isFinite(v)
      : col.dataType === "boolean" ? typeof v === "boolean"
      : true; // json
    // Free-text colours end up in style attributes: only #rrggbb is allowed.
    const badColour = key === "color" && !col.enumValues?.length && !/^#[0-9a-fA-F]{6}$/.test(String(v));
    if (!ok || badColour) return `${where}: "${key}" has an invalid value.`;
    out[key] = v;
  }
  return out;
}

export type ImportCounts = Partial<Record<TableName, number>>;

export async function importAll(input: unknown): Promise<Result<{ counts: ImportCounts }>> {
  const file = input as { format?: unknown; version?: unknown; data?: unknown; preferences?: unknown };
  if (!file || typeof file !== "object" || file.format !== FORMAT) return fail("This isn't a dashboard backup file.");
  if (typeof file.version !== "number" || file.version > VERSION) return fail("This backup is from a newer version of the app.");
  if (!file.data || typeof file.data !== "object") return fail("The backup has no data.");

  const data = file.data as Record<string, unknown>;
  const clean: Partial<Record<TableName, Record<string, unknown>[]>> = {};
  for (const name of Object.keys(TABLES) as TableName[]) {
    const rows = data[name] ?? [];
    if (!Array.isArray(rows)) return fail(`"${name}" should be a list.`);
    const out: Record<string, unknown>[] = [];
    for (const [i, r] of rows.entries()) {
      const row = cleanRow(TABLES[name], r, `${name} #${i + 1}`);
      if (typeof row === "string") return fail(row);
      out.push(row);
    }
    clean[name] = out;
  }
  const prefs = preferencesSchema.safeParse(file.preferences ?? {});
  if (!prefs.success) return fail(`Preferences: ${prefs.error.issues[0].message}`);

  // Children first for the wipe, parents first for the insert; chunks keep
  // each statement under SQLite's variable limit.
  const names = Object.keys(TABLES) as TableName[];
  const wipe = [...names].reverse().map((n) => db.delete(TABLES[n]));
  const inserts = names.flatMap((n) => {
    const rows = clean[n]!;
    return Array.from({ length: Math.ceil(rows.length / 100) }, (_, i) =>
      db.insert(TABLES[n] as typeof categories).values(rows.slice(i * 100, i * 100 + 100) as (typeof categories.$inferInsert)[]),
    );
  });
  const update = Object.keys(prefs.data).length ? [db.update(settings).set(prefs.data).where(eq(settings.id, 1))] : [];
  try {
    await db.batch([...wipe, ...inserts, ...update] as unknown as Parameters<typeof db.batch>[0]);
  } catch (e) {
    return fail(`Nothing was changed — the backup couldn't be applied (${e instanceof Error ? e.message.split("\n")[0] : "database error"}).`);
  }
  return { ok: true, counts: Object.fromEntries(names.map((n) => [n, clean[n]!.length])) };
}
