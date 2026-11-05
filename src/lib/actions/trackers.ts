"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { addEntry, createTracker, deleteEntry, deleteTracker, kindFields, setRating, toggleCheck, updateEntry, updateTracker } from "@/lib/core/trackers";
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

const trackerFields = (fd: FormData) => ({
  name: str(fd, "name"),
  icon: str(fd, "icon") || undefined,
  color: str(fd, "color") || undefined,
  ...kindFields({
    mode: str(fd, "mode"),
    period: str(fd, "period"),
    unit: str(fd, "unit"),
    start: numOrNull(str(fd, "start")),
    target: numOrNull(str(fd, "target")),
    targetDate: str(fd, "targetDate"),
    goal: str(fd, "goal"),
    quickAdd: numOrNull(str(fd, "quickAdd")),
  }),
});

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
