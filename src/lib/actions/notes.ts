"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createCategory, createNote, deleteCategory, deleteNote, emptyArchive, placeNote, updateCategory, updateNote } from "@/lib/core/notes";
import type { FormState } from "./auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
// The side panel lists categories with counts, so refresh the whole app layout.
const refresh = () => revalidatePath("/", "layout");
const done = (res: { ok: boolean; error?: string }): FormState => {
  if (!res.ok) return { error: res.error };
  refresh();
  return { ok: true };
};

// Creating a category opens it; editing stays put.
export async function saveCategoryAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
  const fields = { name: str(fd, "name"), color: str(fd, "color") || undefined, icon: str(fd, "icon") || undefined };
  const id = str(fd, "id");
  if (id) return done(await updateCategory(id, fields));
  const res = await createCategory(fields);
  if (!res.ok) return { error: res.error };
  refresh();
  redirect(`/notes/${res.id}`);
}

export async function deleteCategoryAction(id: string) {
  await requireSession();
  const res = await deleteCategory(id);
  if (!res.ok) return { error: res.error };
  refresh();
  redirect("/notes");
}

export async function createNoteAction(input: Record<string, unknown>): Promise<FormState> {
  await requireSession();
  return done(await createNote(input));
}

export async function updateNoteAction(id: string, patch: Record<string, unknown>): Promise<FormState> {
  await requireSession();
  return done(await updateNote(id, patch));
}

export async function placeNoteAction(id: string, position: number, pinned: boolean): Promise<FormState> {
  await requireSession();
  return done(await placeNote(id, { position, pinned }));
}

export async function emptyArchiveAction(): Promise<FormState> {
  await requireSession();
  return done(await emptyArchive());
}

export async function deleteNoteAction(id: string): Promise<FormState> {
  await requireSession();
  return done(await deleteNote(id));
}
