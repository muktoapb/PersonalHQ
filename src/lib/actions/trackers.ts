"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { addEntry, createTracker, deleteEntry, deleteTracker, setRating, toggleCheck, updateEntry, updateTracker } from "@/lib/core/trackers";
import { today } from "@/lib/dates";
import type { FormState } from "./auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
// "" -> null, otherwise a number (NaN fails validation with a clear message).
const numOrNull = (v: string) => (v === "" ? null : Number(v));
// The side panel lists every tracker, so refresh the whole app layout.
const refresh = () => revalidatePath("/", "layout");
const done = (res: { ok: boolean; error?: string }): FormState => {
  if (!res.ok) return { error: res.error };
  refresh();
  return { ok: true };
};

// Fields by kind, so switching kinds never leaves stale settings behind:
// readings keep a start value; habits have no unit and a goal of N done days
// per day/week/month (a daily habit is 1 a day); amounts/averages can have a
// limit instead of a minimum and a quick-add step; "days since" counts days
// (target = days); ratings are 1–5 with no target.
const trackerFields = (fd: FormData) => {
  const mode = str(fd, "mode") || "latest";
  const amount = mode === "total" || mode === "average";
  const period = mode === "check" || amount ? str(fd, "period") || (mode === "check" ? "day" : "month") : "all";
  return {
    name: str(fd, "name"),
    icon: str(fd, "icon") || undefined,
    color: str(fd, "color") || undefined,
    unit: mode === "latest" || amount ? str(fd, "unit") : "",
    mode,
    period,
    start: mode === "latest" ? numOrNull(str(fd, "start")) : null,
    target:
      mode === "check" ? (period === "day" ? 1 : (numOrNull(str(fd, "target")) ?? 1))
      : mode === "rating" ? null
      : numOrNull(str(fd, "target")),
    targetDate: mode === "latest" || amount ? str(fd, "targetDate") || null : null,
    goal: amount && str(fd, "goal") === "atMost" ? "atMost" : "atLeast",
    quickAdd: amount ? numOrNull(str(fd, "quickAdd")) : null,
  };
};

// Saving (new or edited) goes to the tracker's page. A new "days since"
// tracker starts counting from its `since` date (its first reset).
export async function saveTrackerAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
  let id = str(fd, "id");
  const fields = trackerFields(fd);
  if (id) {
    const res = await updateTracker(id, fields);
    if (!res.ok) return { error: res.error };
  } else {
    const res = await createTracker(fields);
    if (!res.ok) return { error: res.error };
    id = res.id;
    if (fields.mode === "since") await addEntry(id, { date: str(fd, "since") || today(), value: 0, note: "Started" });
  }
  refresh();
  redirect(`/trackers/${id}`);
}

// "Days since": start counting again from today (with an optional note).
export async function resetSinceAction(trackerId: string, note: string): Promise<FormState> {
  await requireSession();
  return done(await addEntry(trackerId, { date: today(), value: 0, note: note.trim() || null }));
}

// Mood/rating: rate a day 1–5 (again to change it).
export async function setRatingAction(trackerId: string, date: string, value: number): Promise<FormState> {
  await requireSession();
  return done(await setRating(trackerId, date, value));
}

// Habits: mark a day done, or undo it.
export async function toggleCheckAction(trackerId: string, date: string): Promise<FormState> {
  await requireSession();
  return done(await toggleCheck(trackerId, date));
}

export async function deleteTrackerAction(id: string) {
  await requireSession();
  const res = await deleteTracker(id);
  if (!res.ok) return { error: res.error };
  refresh();
  redirect("/trackers");
}

export async function addEntryAction(trackerId: string, value: string, date: string, note?: string): Promise<FormState> {
  await requireSession();
  return done(await addEntry(trackerId, { value: numOrNull(value.trim()) ?? Number.NaN, date, note: note?.trim() || null }));
}

export async function updateEntryAction(id: string, patch: { value?: string; date?: string; note?: string }): Promise<FormState> {
  await requireSession();
  return done(
    await updateEntry(id, {
      ...(patch.value !== undefined && { value: numOrNull(patch.value.trim()) ?? Number.NaN }),
      ...(patch.date !== undefined && { date: patch.date }),
      ...(patch.note !== undefined && { note: patch.note.trim() || null }),
    }),
  );
}

export async function deleteEntryAction(id: string): Promise<FormState> {
  await requireSession();
  return done(await deleteEntry(id));
}
