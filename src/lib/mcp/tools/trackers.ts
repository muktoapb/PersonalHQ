import "server-only";
import { z } from "zod";
import { TRACKER_GOALS, TRACKER_MODES, TRACKER_PERIODS } from "@/db/schema";
import {
  addEntry, createTracker, deleteEntry, deleteTracker, getTracker, kindFields, listTrackers, setRating, toggleCheck, updateEntry, updateTracker,
} from "@/lib/core/trackers";
import { today } from "@/lib/dates";
import { GROUP_ICONS } from "@/lib/group-icons";
import { date, id, tool } from "./shared";

// What each mode means, so the assistant picks the right tool.
const MODES = "Modes: check = habit (done per day), total/average = amounts added up or averaged per period, latest = readings (e.g. weight), since = days since a reset, rating = mood 1–5 per day.";

// Settings shared by create and update. Fields that don't fit the mode are
// dropped (kindFields), the same as the web form.
const settings = {
  icon: z.enum(GROUP_ICONS).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("Hex colour, e.g. #7262ea"),
  mode: z.enum(TRACKER_MODES).optional(),
  period: z.enum(TRACKER_PERIODS).optional().describe("check/total/average only: the period the target is per (habits: day/week/month)"),
  unit: z.string().optional().describe("latest/total/average only, e.g. kg, glasses"),
  start: z.number().nullable().optional().describe("latest only: starting value for progress"),
  target: z.number().nullable().optional().describe("Goal value; habits: done days per period; since: days"),
  targetDate: date.nullable().optional().describe("latest/total/average only: deadline"),
  goal: z.enum(TRACKER_GOALS).optional().describe("total/average only: atLeast = reach the target, atMost = stay under it"),
  quickAdd: z.number().positive().nullable().optional().describe("total/average only: step for the quick-add button"),
};

const brief = ({ summary: s, ...t }: Awaited<ReturnType<typeof listTrackers>>[number] | NonNullable<Awaited<ReturnType<typeof getTracker>>>) => ({
  id: t.id,
  name: t.name,
  icon: t.icon,
  color: t.color,
  mode: t.mode,
  period: t.period,
  unit: t.unit,
  goal: t.goal,
  start: t.start,
  target: t.target,
  targetDate: t.targetDate,
  quickAdd: t.quickAdd,
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
    name: "create_tracker",
    description: `Create a tracker. ${MODES}`,
    write: true,
    input: z.object({ name: z.string(), ...settings, since: date.optional().describe("since only: when the count starts; defaults to today") }),
    run: async ({ name, icon, color, since, ...kind }) => {
      const fields = kindFields(kind);
      const res = await createTracker({ name, icon, color, ...fields });
      if (res.ok && fields.mode === "since") await addEntry(res.id, { date: since ?? today(), value: 0, note: "Started" });
      return res;
    },
  }),
  tool({
    name: "update_tracker",
    description: "Change a tracker's name, look, mode, period, unit or target. Pass null to clear a value. Changing the mode keeps existing entries.",
    write: true,
    input: z.object({ id: id("Tracker"), name: z.string().optional(), ...settings }),
    run: async ({ id, name, icon, color, ...patch }) => {
      const cur = await getTracker(id);
      if (!cur) return { ok: false, error: "Tracker not found." };
      return updateTracker(id, { name, icon, color, ...kindFields({ ...cur, ...patch }) });
    },
  }),
  tool({
    name: "delete_tracker",
    description: "Permanently delete a tracker and all its entries.",
    write: true,
    input: z.object({ id: id("Tracker") }),
    run: ({ id }) => deleteTracker(id),
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
  tool({
    name: "update_tracker_entry",
    description: "Change an entry's date, value or note (entry ids come from get_tracker). Pass note null to clear it.",
    write: true,
    input: z.object({ id: id("Entry"), date: date.optional(), value: z.number().optional(), note: z.string().nullable().optional() }),
    run: ({ id, ...patch }) => updateEntry(id, patch),
  }),
  tool({
    name: "delete_tracker_entry",
    description: "Delete one entry from a tracker (entry ids come from get_tracker).",
    write: true,
    input: z.object({ id: id("Entry") }),
    run: ({ id }) => deleteEntry(id),
  }),
];
