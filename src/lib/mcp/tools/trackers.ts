import "server-only";
import { z } from "zod";
import { addEntry, getTracker, listTrackers, setRating, toggleCheck } from "@/lib/core/trackers";
import { today } from "@/lib/dates";
import { date, id, tool } from "./shared";

// What each mode means, so the assistant picks the right tool.
const MODES = "Modes: check = habit (done per day), total/average = amounts added up or averaged per period, latest = readings (e.g. weight), since = days since a reset, rating = mood 1–5 per day.";

const brief = ({ summary: s, ...t }: Awaited<ReturnType<typeof listTrackers>>[number] | NonNullable<Awaited<ReturnType<typeof getTracker>>>) => ({
  id: t.id,
  name: t.name,
  mode: t.mode,
  period: t.period,
  unit: t.unit,
  goal: t.goal,
  target: t.target,
  current: s.current,
  progress: s.progress,
  reached: s.reached,
  streak: s.streak,
  best: s.best,
  doneToday: s.doneToday,
});

export const trackerTools = [
  tool({
    name: "list_trackers",
    description: `List trackers with their current value and progress. ${MODES}`,
    input: z.object({}),
    run: async () => (await listTrackers()).map(brief),
  }),
  tool({
    name: "get_tracker",
    description: "One tracker's summary and its latest entries.",
    input: z.object({ id: id("Tracker"), limit: z.number().int().min(1).max(200).default(30) }),
    run: async ({ id, limit }) => {
      const t = await getTracker(id);
      if (!t) return { ok: false, error: "Tracker not found." };
      return { ...brief(t), entries: t.entries.slice(0, limit).map(({ id, date, value, note }) => ({ id, date, value, note })) };
    },
  }),
  tool({
    name: "log_tracker_entry",
    description: "Log a value on a total, average or latest tracker (e.g. 2 glasses, 71.5 kg). For a since tracker, logs a reset (value 0).",
    write: true,
    input: z.object({ trackerId: id("Tracker"), value: z.number(), date: date.optional().describe("Defaults to today"), note: z.string().optional() }),
    run: ({ trackerId, value, date, note }) => addEntry(trackerId, { value, date: date ?? today(), note: note || null }),
  }),
  tool({
    name: "toggle_habit",
    description: "Mark a habit (check tracker) done for a day, or undo it if it already is.",
    write: true,
    input: z.object({ trackerId: id("Tracker"), date: date.optional().describe("Defaults to today") }),
    run: ({ trackerId, date }) => toggleCheck(trackerId, date ?? today()),
  }),
  tool({
    name: "rate_day",
    description: "Set the 1–5 rating for a day on a mood (rating) tracker.",
    write: true,
    input: z.object({ trackerId: id("Tracker"), value: z.number().int().min(1).max(5), date: date.optional().describe("Defaults to today") }),
    run: ({ trackerId, value, date }) => setRating(trackerId, date ?? today(), value),
  }),
];
