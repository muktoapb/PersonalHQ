"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  addColumn,
  addNote,
  claimDueReminders,
  createGroup,
  createLabel,
  createTask,
  deleteColumn,
  deleteGroup,
  deleteLabel,
  deleteNote,
  deleteTask,
  moveColumn,
  reorderColumns,
  renameColumn,
  setColumnDone,
  setTaskLabel,
  updateGroup,
  updateLabel,
  updateTask,
} from "@/lib/core/tasks";
import type { FormState } from "./auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
// The side panel lists every group with counts, so refresh the whole app layout.
const refresh = () => revalidatePath("/", "layout");
const done = (res: { ok: boolean; error?: string }): FormState => {
  if (!res.ok) return { error: res.error };
  refresh();
  return { ok: true };
};
const groupFields = (fd: FormData) => ({
  name: str(fd, "name"),
  color: str(fd, "color") || undefined,
  icon: str(fd, "icon") || undefined,
  view: str(fd, "view") || undefined,
});

// Creating a group opens it; editing stays put.
export async function saveGroupAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
  const id = str(fd, "id");
  if (id) return done(await updateGroup(id, groupFields(fd)));
  const res = await createGroup(groupFields(fd));
  if (!res.ok) return { error: res.error };
  refresh();
  redirect(`/tasks/${res.id}`);
}

export async function setGroupViewAction(id: string, view: "list" | "board"): Promise<FormState> {
  await requireSession();
  return done(await updateGroup(id, { view }));
}

export async function deleteGroupAction(id: string) {
  await requireSession();
  const res = await deleteGroup(id);
  if (!res.ok) return { error: res.error };
  refresh();
  redirect("/tasks");
}

// ---------- board columns ----------

export async function addColumnAction(groupId: string, name: string): Promise<FormState> {
  await requireSession();
  return done(await addColumn(groupId, { name }));
}

export async function renameColumnAction(id: string, name: string): Promise<FormState> {
  await requireSession();
  return done(await renameColumn(id, { name }));
}

export async function moveColumnAction(id: string, dir: -1 | 1): Promise<FormState> {
  await requireSession();
  return done(await moveColumn(id, dir === -1 ? -1 : 1));
}

export async function reorderColumnsAction(groupId: string, ids: string[]): Promise<FormState> {
  await requireSession();
  return done(await reorderColumns(groupId, ids));
}

export async function addTaskToColumnAction(groupId: string, columnId: string, title: string): Promise<FormState> {
  await requireSession();
  return done(await createTask({ groupId, columnId, title }));
}

export async function setColumnDoneAction(id: string, isDone: boolean): Promise<FormState> {
  await requireSession();
  return done(await setColumnDone(id, Boolean(isDone)));
}

export async function deleteColumnAction(id: string): Promise<FormState> {
  await requireSession();
  return done(await deleteColumn(id));
}

// ---------- tasks ----------

export async function createTaskAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
  return done(await createTask({ groupId: str(fd, "groupId"), title: str(fd, "title"), due: str(fd, "due") }));
}

export async function addSubtaskAction(parentId: string, groupId: string, title: string): Promise<FormState> {
  await requireSession();
  return done(await createTask({ groupId, parentId, title }));
}

export async function updateTaskAction(id: string, patch: Record<string, unknown>): Promise<FormState> {
  await requireSession();
  return done(await updateTask(id, patch));
}

export async function deleteTaskAction(id: string): Promise<FormState> {
  await requireSession();
  return done(await deleteTask(id));
}

export async function createLabelAction(name: string, color: string): Promise<FormState & { id?: string }> {
  await requireSession();
  const res = await createLabel({ name, color });
  if (!res.ok) return { error: res.error };
  refresh();
  return { ok: true, id: res.id };
}

export async function deleteLabelAction(id: string): Promise<FormState> {
  await requireSession();
  return done(await deleteLabel(id));
}

export async function updateLabelAction(id: string, patch: { name?: string; color?: string }): Promise<FormState> {
  await requireSession();
  return done(await updateLabel(id, patch));
}

export async function setTaskLabelAction(taskId: string, labelId: string, on: boolean): Promise<FormState> {
  await requireSession();
  return done(await setTaskLabel(taskId, labelId, on));
}

export async function addNoteAction(taskId: string, body: string): Promise<FormState> {
  await requireSession();
  return done(await addNote(taskId, { body }));
}

export async function deleteNoteAction(id: string): Promise<FormState> {
  await requireSession();
  return done(await deleteNote(id));
}

// Polled by ReminderWatcher while the app is open.
export async function claimRemindersAction() {
  await requireSession();
  return claimDueReminders();
}
