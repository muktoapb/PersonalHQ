import "server-only";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { NOTE_COLORS, noteCategories, notes } from "@/db/schema";
import { GROUP_ICONS } from "@/lib/group-icons";
import { type Result, fail } from "./result";

// Notes (Google Keep-style): text or checklist, colour, pinned, archived,
// grouped by optional categories.

// Create schemas fill defaults; patch schemas must not (zod applies defaults
// even inside .partial(), which would overwrite fields a patch leaves out).
const categoryFields = {
  name: z.string().trim().min(1, "Name required.").max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.enum(GROUP_ICONS),
};
export const categorySchema = z.object({ ...categoryFields, color: categoryFields.color.default("#7262ea"), icon: categoryFields.icon.default("star") });
export const categoryPatchSchema = z.object(categoryFields).partial();

const item = z.object({ text: z.string().max(500), done: z.boolean() });
const noteFields = {
  categoryId: z.uuid().nullable(),
  title: z.string().trim().max(200),
  body: z.string().max(20_000),
  items: z.array(item).max(200).nullable(),
  color: z.enum(NOTE_COLORS),
  pinned: z.boolean(),
  archived: z.boolean(),
};
export const noteSchema = z.object({
  categoryId: noteFields.categoryId.default(null),
  title: noteFields.title.default(""),
  body: noteFields.body.default(""),
  items: noteFields.items.default(null),
  color: noteFields.color.default("default"),
  pinned: noteFields.pinned.default(false),
  archived: noteFields.archived.default(false),
});
export const notePatchSchema = z.object(noteFields).partial();

// A note needs something in it; checklist items that are empty are dropped.
function clean<T extends { title?: string; body?: string; items?: { text: string; done: boolean }[] | null }>(n: T) {
  const items = n.items?.map((i) => ({ ...i, text: i.text.trim() })).filter((i) => i.text) ?? n.items;
  return { ...n, items };
}
const isEmpty = (n: { title: string; body: string; items: unknown[] | null }) => !n.title && !n.body.trim() && !n.items?.length;

// ---------- categories ----------

export const listCategories = () => db.select().from(noteCategories).orderBy(asc(noteCategories.createdAt));

export async function getCategory(id: string) {
  const [c] = await db.select().from(noteCategories).where(eq(noteCategories.id, id));
  return c ?? null;
}

export async function createCategory(input: unknown): Promise<Result<{ id: string }>> {
  const p = categorySchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const [row] = await db.insert(noteCategories).values(p.data).returning({ id: noteCategories.id });
  return { ok: true, id: row.id };
}

export async function updateCategory(id: string, input: unknown): Promise<Result> {
  const p = categoryPatchSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const res = await db.update(noteCategories).set(p.data).where(eq(noteCategories.id, id));
  return res.rowsAffected ? { ok: true } : fail("Category not found.");
}

// Notes survive: they become uncategorised. (Explicit, since SQLite only
// applies ON DELETE SET NULL with foreign_keys on.)
export async function deleteCategory(id: string): Promise<Result> {
  const [, res] = await db.batch([
    db.update(notes).set({ categoryId: null }).where(eq(notes.categoryId, id)),
    db.delete(noteCategories).where(eq(noteCategories.id, id)),
  ]);
  return res.rowsAffected ? { ok: true } : fail("Category not found.");
}

// ---------- notes ----------

export type NoteFilter = { categoryId?: string; archived?: boolean; q?: string };

// Pinned first, then your manual order (drag to change). `q` searches title, text and checklist items.
export async function listNotes(f: NoteFilter = {}) {
  const w: SQL[] = [eq(notes.archived, f.archived ?? false)];
  if (f.categoryId) w.push(eq(notes.categoryId, f.categoryId));
  if (f.q?.trim()) {
    const like = `%${f.q.trim().replace(/[%_]/g, "")}%`;
    w.push(sql`(${notes.title} like ${like} or ${notes.body} like ${like} or ${notes.items} like ${like})`);
  }
  return db
    .select({
      id: notes.id,
      categoryId: notes.categoryId,
      title: notes.title,
      body: notes.body,
      items: notes.items,
      color: notes.color,
      pinned: notes.pinned,
      archived: notes.archived,
      position: notes.position,
      updatedAt: notes.updatedAt,
      categoryName: noteCategories.name,
      categoryColor: noteCategories.color,
    })
    .from(notes)
    .leftJoin(noteCategories, eq(noteCategories.id, notes.categoryId))
    .where(and(...w))
    .orderBy(desc(notes.pinned), asc(notes.position), desc(notes.updatedAt));
}
export type NoteRow = Awaited<ReturnType<typeof listNotes>>[number];

async function checkCategory(categoryId: string | null | undefined) {
  if (categoryId && !(await getCategory(categoryId))) return fail("Category not found.");
  return null;
}

export async function createNote(input: unknown): Promise<Result<{ id: string }>> {
  const p = noteSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const n = clean(p.data);
  if (isEmpty(n)) return fail("The note is empty.");
  const bad = await checkCategory(n.categoryId);
  if (bad) return bad;
  // New notes go first.
  const [{ min }] = await db.select({ min: sql<number | null>`min(${notes.position})` }).from(notes);
  const [row] = await db.insert(notes).values({ ...n, position: (min ?? 0) - 1 }).returning({ id: notes.id });
  return { ok: true, id: row.id };
}

export async function updateNote(id: string, input: unknown): Promise<Result> {
  const p = notePatchSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const bad = await checkCategory(p.data.categoryId);
  if (bad) return bad;
  const res = await db
    .update(notes)
    .set({ ...clean(p.data), updatedAt: new Date().toISOString() })
    .where(eq(notes.id, id));
  return res.rowsAffected ? { ok: true } : fail("Note not found.");
}

// Drag-and-drop: a new place (and pinned state, when dropped in the other
// section). Doesn't count as an edit, so "Edited" keeps its time.
export const placeSchema = z.object({ position: z.number().finite(), pinned: z.boolean() });
export async function placeNote(id: string, input: unknown): Promise<Result> {
  const p = placeSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const res = await db.update(notes).set(p.data).where(eq(notes.id, id));
  return res.rowsAffected ? { ok: true } : fail("Note not found.");
}

// Permanently deletes every archived note.
export async function emptyArchive(): Promise<Result<{ count: number }>> {
  const res = await db.delete(notes).where(eq(notes.archived, true));
  return { ok: true, count: res.rowsAffected };
}

export async function deleteNote(id: string): Promise<Result> {
  const res = await db.delete(notes).where(eq(notes.id, id));
  return res.rowsAffected ? { ok: true } : fail("Note not found.");
}
