import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { TRACKER_GOALS, TRACKER_MODES, TRACKER_PERIODS, type Tracker, type TrackerEntry, type TrackerPeriod, trackerEntries, trackers } from "@/db/schema";
import { today as todayStr, ymd } from "@/lib/dates";
import { GROUP_ICONS } from "@/lib/group-icons";
import { type Result, fail } from "./result";
import { getSettings } from "./settings";

// Trackers: numbers over time with an optional target (see the modes in
// db/schema.ts). Periods are day/week/month/year (weeks start Monday) or all
// time. Habits ("check") count done days per period, and streaks count
// periods in a row that met the target. "since" trackers treat each entry as
// a reset. Amount/average targets can be a minimum or a limit (`goal`).

const number = () => z.number({ error: "Enter a number." }).finite("Enter a number.");
const num = number().nullable();
// Create fills defaults; the patch must not (zod applies defaults even inside
// .partial(), which would reset fields a patch leaves out).
const trackerFields = {
  name: z.string().trim().min(1, "Name required.").max(60),
  icon: z.enum(GROUP_ICONS),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  unit: z.string().trim().max(20),
  mode: z.enum(TRACKER_MODES),
  period: z.enum(TRACKER_PERIODS),
  start: num,
  target: num,
  targetDate: z.iso.date().nullable(),
  goal: z.enum(TRACKER_GOALS),
  quickAdd: number().positive("Quick add must be more than 0.").nullable(),
};
export const trackerSchema = z.object({
  ...trackerFields,
  icon: trackerFields.icon.default("star"),
  color: trackerFields.color.default("#7262ea"),
  unit: trackerFields.unit.default(""),
  mode: trackerFields.mode.default("latest"),
  period: trackerFields.period.default("all"),
  start: num.default(null),
  target: num.default(null),
  targetDate: trackerFields.targetDate.default(null),
  goal: trackerFields.goal.default("atLeast"),
  quickAdd: trackerFields.quickAdd.default(null),
});
export const trackerPatchSchema = z.object(trackerFields).partial();

// Fields by kind, so switching kinds never leaves stale settings behind:
// readings keep a start value; habits have no unit and a goal of N done days
// per day/week/month (a daily habit is 1 a day); amounts/averages can have a
// limit instead of a minimum and a quick-add step; "days since" counts days
// (target = days); ratings are 1–5 with no target. Shared by the form and MCP.
type KindInput = { mode?: string; period?: string; unit?: string; start?: number | null; target?: number | null; targetDate?: string | null; goal?: string; quickAdd?: number | null };
export function kindFields(k: KindInput) {
  const mode = k.mode || "latest";
  const amount = mode === "total" || mode === "average";
  const period = mode === "check" || amount ? k.period || (mode === "check" ? "day" : "month") : "all";
  return {
    mode,
    period,
    unit: mode === "latest" || amount ? (k.unit ?? "") : "",
    start: mode === "latest" ? (k.start ?? null) : null,
    target: mode === "check" ? (period === "day" ? 1 : (k.target ?? 1)) : mode === "rating" ? null : (k.target ?? null),
    targetDate: mode === "latest" || amount ? k.targetDate || null : null,
    goal: amount && k.goal === "atMost" ? "atMost" : "atLeast",
    quickAdd: amount ? (k.quickAdd ?? null) : null,
  };
}

const entryFields = { date: z.iso.date("Pick a date."), value: number(), note: z.string().trim().max(300).nullable() };
export const entrySchema = z.object({ ...entryFields, note: entryFields.note.default(null) });
export const entryPatchSchema = z.object(entryFields).partial();

// ---------- trackers ----------

export async function listTrackers() {
  const [rows, entries] = await Promise.all([
    db.select().from(trackers).orderBy(asc(trackers.createdAt)),
    db.select().from(trackerEntries).orderBy(asc(trackerEntries.date), asc(trackerEntries.createdAt)),
  ]);
  const t = todayStr();
  const ws = (await getSettings())?.weekStart ?? 1;
  const weekAgo = ymd(new Date(Date.now() - 7 * 86_400_000));
  return rows.map((tr) => {
    const own = entries.filter((e) => e.trackerId === tr.id);
    return {
      ...tr,
      entryCount: own.length,
      summary: summarize(tr, own, t, ws),
      spark: series(tr, own, t, 10, ws).map((p) => p.value),
      // Habits: done days in the last week (for the card's dots).
      recentDays: tr.mode === "check" ? own.filter((e) => e.date > weekAgo).map((e) => e.date) : [],
    };
  });
}
export type TrackerCard = Awaited<ReturnType<typeof listTrackers>>[number];

// Just what the side panel and the quick-add sheet need.
export const listTrackerNames = () =>
  db
    .select({ id: trackers.id, name: trackers.name, icon: trackers.icon, color: trackers.color, mode: trackers.mode, unit: trackers.unit, quickAdd: trackers.quickAdd })
    .from(trackers)
    .orderBy(asc(trackers.createdAt));

// One tracker with its entries (newest first), summary and chart series.
export async function getTracker(id: string) {
  const [tr] = await db.select().from(trackers).where(eq(trackers.id, id));
  if (!tr) return null;
  const entries = await db.select().from(trackerEntries).where(eq(trackerEntries.trackerId, id)).orderBy(asc(trackerEntries.date), asc(trackerEntries.createdAt));
  const t = todayStr();
  const ws = (await getSettings())?.weekStart ?? 1;
  return { ...tr, entries: [...entries].reverse(), summary: summarize(tr, entries, t, ws), chart: series(tr, entries, t, 12, ws), days: entries.map((e) => e.date) };
}

export async function createTracker(input: unknown): Promise<Result<{ id: string }>> {
  const p = trackerSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const [row] = await db.insert(trackers).values(p.data).returning({ id: trackers.id });
  return { ok: true, id: row.id };
}

export async function updateTracker(id: string, input: unknown): Promise<Result> {
  const p = trackerPatchSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const res = await db.update(trackers).set(p.data).where(eq(trackers.id, id));
  return res.rowsAffected ? { ok: true } : fail("Tracker not found.");
}

// Entries go explicitly: SQLite only cascades with PRAGMA foreign_keys on.
export async function deleteTracker(id: string): Promise<Result> {
  const [, res] = await db.batch([db.delete(trackerEntries).where(eq(trackerEntries.trackerId, id)), db.delete(trackers).where(eq(trackers.id, id))]);
  return res.rowsAffected ? { ok: true } : fail("Tracker not found.");
}

// ---------- entries ----------

export async function addEntry(trackerId: string, input: unknown): Promise<Result<{ id: string }>> {
  const p = entrySchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const [tr] = await db.select({ id: trackers.id }).from(trackers).where(eq(trackers.id, trackerId));
  if (!tr) return fail("Tracker not found.");
  const [row] = await db.insert(trackerEntries).values({ ...p.data, trackerId }).returning({ id: trackerEntries.id });
  return { ok: true, id: row.id };
}

// Habits: mark a day done, or undo it if it already is.
export async function toggleCheck(trackerId: string, date: string): Promise<Result<{ done: boolean }>> {
  const d = z.iso.date().safeParse(date);
  if (!d.success) return fail("Pick a date.");
  const [tr] = await db.select({ mode: trackers.mode }).from(trackers).where(eq(trackers.id, trackerId));
  if (!tr) return fail("Tracker not found.");
  if (tr.mode !== "check") return fail("Only habits can be checked off.");
  const where = and(eq(trackerEntries.trackerId, trackerId), eq(trackerEntries.date, d.data));
  const [had] = await db.select({ id: trackerEntries.id }).from(trackerEntries).where(where);
  if (had) {
    await db.delete(trackerEntries).where(where);
    return { ok: true, done: false };
  }
  await db.insert(trackerEntries).values({ trackerId, date: d.data, value: 1 });
  return { ok: true, done: true };
}

// Ratings: one per day — rating a day again replaces it.
export async function setRating(trackerId: string, date: string, value: number): Promise<Result> {
  const p = z.object({ date: z.iso.date("Pick a date."), value: z.number().int().min(1).max(5) }).safeParse({ date, value });
  if (!p.success) return fail(p.error.issues[0].message);
  const [tr] = await db.select({ mode: trackers.mode }).from(trackers).where(eq(trackers.id, trackerId));
  if (!tr) return fail("Tracker not found.");
  if (tr.mode !== "rating") return fail("Only mood/rating trackers take ratings.");
  await db.batch([
    db.delete(trackerEntries).where(and(eq(trackerEntries.trackerId, trackerId), eq(trackerEntries.date, p.data.date))),
    db.insert(trackerEntries).values({ trackerId, date: p.data.date, value: p.data.value }),
  ]);
  return { ok: true };
}

export async function updateEntry(id: string, input: unknown): Promise<Result> {
  const p = entryPatchSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const res = await db.update(trackerEntries).set(p.data).where(eq(trackerEntries.id, id));
  return res.rowsAffected ? { ok: true } : fail("Entry not found.");
}

export async function deleteEntry(id: string): Promise<Result> {
  const res = await db.delete(trackerEntries).where(eq(trackerEntries.id, id));
  return res.rowsAffected ? { ok: true } : fail("Entry not found.");
}

// ---------- maths ----------

const parse = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
};

// First day of the period containing `day`; null for "all". Weeks start on
// `weekStart` (0 Sunday, 1 Monday, 6 Saturday — a Settings choice).
export function periodStart(period: TrackerPeriod, day: string, weekStart = 1): string | null {
  const d = parse(day);
  if (period === "day") return day;
  if (period === "week") return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() - weekStart + 7) % 7)));
  if (period === "month") return ymd(new Date(d.getFullYear(), d.getMonth(), 1));
  if (period === "year") return ymd(new Date(d.getFullYear(), 0, 1));
  return null;
}

// The start of the period before the one starting at `start`.
function previousStart(period: TrackerPeriod, start: string) {
  const d = parse(start);
  if (period === "day") return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
  if (period === "week") return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
  if (period === "month") return ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  return ymd(new Date(d.getFullYear() - 1, 0, 1));
}

// Habit streaks: periods in a row that met the target — the current period
// counts once met, and doesn't break the streak while still in progress —
// and the best run ever.
function streaks(period: TrackerPeriod, goal: number, days: Set<string>, today: string, ws: number) {
  const sorted = [...days].sort();
  if (!sorted.length) return { streak: 0, best: 0 };
  const starts: string[] = []; // newest first
  for (let st = periodStart(period, today, ws)!, stop = periodStart(period, sorted[0], ws)!; st >= stop; st = previousStart(period, st)) starts.push(st);
  const met = starts.map((st, i) => sorted.filter((d) => d >= st && (i === 0 || d < starts[i - 1])).length >= goal);
  let streak = 0;
  for (let k = met[0] ? 0 : 1; k < met.length && met[k]; k++) streak++;
  let best = 0, run = 0;
  for (const m of met) best = Math.max(best, (run = m ? run + 1 : 0));
  return { streak, best };
}

const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);

// Sum of each day's entries.
function dailyTotals(entries: TrackerEntry[]) {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.date, (m.get(e.date) ?? 0) + e.value);
  return m;
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Progress against a target that is a minimum (reach it) or a limit (stay under it).
function goalStatus(t: Tracker, current: number | null) {
  if (t.target == null || current == null) return { progress: null, left: null, reached: false, over: false };
  if (t.goal === "atMost")
    return { progress: t.target ? current / t.target : 1, left: Math.max(t.target - current, 0), reached: current <= t.target, over: current > t.target };
  return { progress: t.target ? Math.max(0, current / t.target) : 1, left: Math.max(t.target - current, 0), reached: current >= t.target, over: false };
}

// "Days since" runs: from each reset to the next one (the last run is ongoing).
function runs(entries: TrackerEntry[], today: string) {
  const dates = [...new Set(entries.map((e) => e.date))].sort();
  return dates.map((d, i) => ({ start: d, days: daysBetween(d, dates[i + 1] ?? today) }));
}

// Where a tracker stands today. `progress` is 0..1 toward the target (for a
// limit, how much of it is used; null without a target); `left` is what
// remains. Habits and "since" trackers also get streaks.
export function summarize(t: Tracker, entries: TrackerEntry[], today: string, ws = 1) {
  const daysLeft = t.targetDate ? daysBetween(today, t.targetDate) : null;
  const base = { base: 0 as number | null, change: null as number | null, daysLeft, streak: null as number | null, best: null as number | null, doneToday: false, todayValue: null as number | null, total: entries.length, over: false };

  if (t.mode === "check") {
    const days = new Set(entries.map((e) => e.date));
    const period = t.period === "all" || t.period === "year" ? "week" : t.period;
    const from = periodStart(period, today, ws)!;
    const current = [...days].filter((d) => d >= from).length;
    const goal = Math.max(1, t.target ?? 1);
    const { streak, best } = streaks(period, goal, days, today, ws);
    return { ...base, current, progress: current / goal, left: Math.max(goal - current, 0), reached: current >= goal, streak, best, doneToday: days.has(today), total: days.size };
  }
  if (t.mode === "since") {
    const r = runs(entries, today);
    const current = r.at(-1)?.days ?? 0;
    const best = Math.max(0, ...r.map((x) => x.days));
    const progress = t.target ? current / t.target : null;
    return { ...base, current, progress, left: t.target != null ? Math.max(t.target - current, 0) : null, reached: t.target != null && current >= t.target, streak: current, best, total: r.length - 1 };
  }
  if (t.mode === "rating") {
    const byDay = new Map(entries.map((e) => [e.date, e.value]));
    const week = periodStart("week", today, ws)!, lastWeek = previousStart("week", week);
    const thisAvg = mean([...byDay].filter(([d]) => d >= week).map(([, v]) => v));
    const lastAvg = mean([...byDay].filter(([d]) => d >= lastWeek && d < week).map(([, v]) => v));
    return { ...base, current: thisAvg, change: thisAvg != null && lastAvg != null ? thisAvg - lastAvg : null, progress: null, left: null, reached: false, todayValue: byDay.get(today) ?? null, total: byDay.size };
  }
  if (t.mode === "total" || t.mode === "average") {
    const from = periodStart(t.period, today, ws);
    const inPeriod = entries.filter((e) => !from || e.date >= from);
    const current = t.mode === "total" ? inPeriod.reduce((a, e) => a + e.value, 0) : mean([...dailyTotals(inPeriod).values()]);
    return { ...base, current, ...goalStatus(t, current) };
  }
  // latest (readings)
  const last = entries.at(-1), prev = entries.at(-2);
  const current = last?.value ?? null;
  const start = t.start ?? entries[0]?.value ?? null;
  let progress: number | null = null;
  if (t.target != null && start != null && current != null) {
    progress = t.target === start ? (current === start ? 1 : 0) : Math.max(0, (current - start) / (t.target - start));
  }
  return {
    ...base,
    current,
    base: start,
    change: last && prev ? last.value - prev.value : null,
    progress,
    left: t.target != null && current != null ? ((progress ?? 0) < 1 ? Math.abs(t.target - current) : 0) : null,
    reached: progress != null && progress >= 1,
  };
}
export type TrackerSummary = ReturnType<typeof summarize>;

const short = (d: string, opts: Intl.DateTimeFormatOptions) => parse(d).toLocaleDateString("en-US", opts);
const point = (date: string, value: number) => ({ label: short(date, { month: "short", day: "numeric" }), value, date });

// Chart points, oldest first: readings and ratings as they were logged; runs
// for "since"; a running total for all-time amounts; otherwise one value per
// period (sum, average of daily totals, or done days for habits).
export function series(t: Tracker, entries: TrackerEntry[], today: string, n: number, ws = 1): { label: string; value: number; date: string }[] {
  const recent = Math.max(n, 30);
  if (t.mode === "latest") return entries.slice(-recent).map((e) => point(e.date, e.value));
  if (t.mode === "rating") return [...new Map(entries.map((e) => [e.date, e.value]))].slice(-recent).map(([d, v]) => point(d, v));
  if (t.mode === "since") return runs(entries, today).slice(-n).map((r) => point(r.start, r.days));
  if (t.mode === "total" && t.period === "all") {
    let run = 0;
    const byDay = new Map<string, number>();
    for (const e of entries) byDay.set(e.date, (run += e.value));
    return [...byDay].slice(-recent).map(([date, value]) => point(date, value));
  }
  // n periods back from the current one.
  const period: TrackerPeriod = t.period === "all" ? (t.mode === "check" ? "week" : "month") : t.mode === "check" && t.period === "year" ? "week" : t.period;
  const starts: string[] = [];
  let cursor = periodStart(period, today, ws)!;
  for (let i = 0; i < n; i++) {
    starts.unshift(cursor);
    cursor = previousStart(period, cursor);
  }
  return starts.map((s, i) => {
    const end = starts[i + 1];
    const inside = entries.filter((e) => e.date >= s && (!end || e.date < end));
    const value =
      t.mode === "check" ? new Set(inside.map((e) => e.date)).size
      : t.mode === "average" ? (mean([...dailyTotals(inside).values()]) ?? 0)
      : inside.reduce((a, e) => a + e.value, 0);
    const label = period === "year" ? s.slice(0, 4) : period === "month" ? short(s, { month: "short" }) : period === "day" ? short(s, { weekday: "narrow" }) : short(s, { month: "short", day: "numeric" });
    return { label, value, date: s };
  });
}
