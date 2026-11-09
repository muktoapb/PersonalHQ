import "server-only";
import { and, asc, count, eq, gte, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { LIST_VIEWS, labels, taskColumns, taskGroups, taskLabels, taskNotes, tasks } from "@/db/schema";
import { addDays, today } from "@/lib/dates";
import { GROUP_ICONS } from "@/lib/group-icons";
import { type Result, fail } from "./result";

// Tasks: groups hold tasks and choose their view (checklist or board). Each
// group has its own board columns; a column can count as "done", and a task's
// status (todo/done) always matches its column. Tasks can have subtasks (one
// level, rows with parentId), labels, short notes, and a due date with an
// optional time, reminder and repeat interval. Counts and views only consider
// top-level tasks.

const name = z.string().trim().min(1, "Name required.").max(60);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const title = z.string().trim().min(1, "Title required.").max(300);
const optional = <T extends z.ZodType>(t: T) => z.union([t, z.literal(""), z.null()]).optional().transform((v) => (v === "" ? null : v));

// Create fills defaults; the patch must not (zod applies defaults even inside
// .partial(), which would reset fields a patch leaves out).
const groupFields = { name, color, icon: z.enum(GROUP_ICONS), view: z.enum(LIST_VIEWS) };
export const groupSchema = z.object({
  ...groupFields,
  color: color.default("#7262ea"),
  icon: groupFields.icon.default("checklist"),
  view: groupFields.view.default("list"),
});
export const groupPatchSchema = z.object(groupFields).partial();
const repeatEvery = z.number().int().min(1, "Repeat every 1–30 days.").max(30, "Repeat every 1–30 days.");
export const taskSchema = z.object({ groupId: z.uuid(), parentId: z.uuid().nullish(), columnId: z.uuid().nullish(), title, due: optional(z.iso.date()), repeatEvery: repeatEvery.nullish() });
export const taskPatchSchema = z
  .object({
    title,
    status: z.enum(["todo", "done"]),
    columnId: z.uuid(),
    due: optional(z.iso.date()),
    dueTime: optional(z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM.")),
    remindOffset: z.number().int().min(0).max(60 * 24 * 7).nullable(),
    remindAt: z.iso.datetime().nullable(),
    repeatEvery: repeatEvery.nullable(),
  })
  .partial();
// .partial() keeps the colour default out of updates (labelSchema.partial() would apply it).
const labelFields = { name: z.string().trim().min(1, "Name required.").max(30), color };
export const labelSchema = z.object({ ...labelFields, color: color.default("#7262ea") });
export const labelPatchSchema = z.object(labelFields).partial();
export const noteSchema = z.object({ body: z.string().trim().min(1, "Write something first.").max(2000) });

const topLevel = isNull(tasks.parentId);

export const columnSchema = z.object({ name: z.string().trim().min(1, "Name required.").max(40) });

const now = () => new Date().toISOString();
const DEFAULT_COLUMNS = [
  { name: "To do", position: 0, done: false },
  { name: "Doing", position: 1, done: false },
  { name: "Done", position: 2, done: true },
];

// ---------- groups ----------

export const listGroups = () => db.select().from(taskGroups).orderBy(asc(taskGroups.createdAt));

export async function getGroup(id: string) {
  const [g] = await db.select().from(taskGroups).where(eq(taskGroups.id, id));
  return g ?? null;
}

export async function createGroup(input: unknown): Promise<Result<{ id: string }>> {
  const p = groupSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(taskGroups).values({ ...p.data, id }),
    db.insert(taskColumns).values(DEFAULT_COLUMNS.map((c) => ({ ...c, groupId: id }))),
  ]);
  return { ok: true, id };
}

export async function updateGroup(id: string, input: unknown): Promise<Result> {
  const p = groupPatchSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const res = await db.update(taskGroups).set(p.data).where(eq(taskGroups.id, id));
  return res.rowsAffected ? { ok: true } : fail("Group not found.");
}

// Child rows go explicitly: SQLite only cascades with PRAGMA foreign_keys on.
export async function deleteGroup(id: string): Promise<Result> {
  const ids = db.select({ id: tasks.id }).from(tasks).where(eq(tasks.groupId, id));
  const [, , , , res] = await db.batch([
    db.delete(taskNotes).where(inArray(taskNotes.taskId, ids)),
    db.delete(taskLabels).where(inArray(taskLabels.taskId, ids)),
    db.delete(tasks).where(eq(tasks.groupId, id)),
    db.delete(taskColumns).where(eq(taskColumns.groupId, id)),
    db.delete(taskGroups).where(eq(taskGroups.id, id)),
  ]);
  return res.rowsAffected ? { ok: true } : fail("Group not found.");
}

// ---------- columns ----------

// Columns of one group (or of every group), in board order.
export const listColumns = (groupId?: string) =>
  db
    .select()
    .from(taskColumns)
    .where(groupId ? eq(taskColumns.groupId, groupId) : undefined)
    .orderBy(asc(taskColumns.groupId), asc(taskColumns.position));

// New columns go before the first "done" column, so done stays last.
export async function addColumn(groupId: string, input: unknown): Promise<Result> {
  const p = columnSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  if (!(await getGroup(groupId))) return fail("Group not found.");
  const cols = await listColumns(groupId);
  if (cols.length >= 12) return fail("A board can have up to 12 columns.");
  const firstDone = cols.find((c) => c.done);
  if (!firstDone) {
    await db.insert(taskColumns).values({ groupId, name: p.data.name, position: (cols.at(-1)?.position ?? -1) + 1 });
    return { ok: true };
  }
  await db.batch([
    db.update(taskColumns).set({ position: sql`${taskColumns.position} + 1` }).where(and(eq(taskColumns.groupId, groupId), gte(taskColumns.position, firstDone.position))),
    db.insert(taskColumns).values({ groupId, name: p.data.name, position: firstDone.position }),
  ]);
  return { ok: true };
}

export async function renameColumn(id: string, input: unknown): Promise<Result> {
  const p = columnSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const res = await db.update(taskColumns).set(p.data).where(eq(taskColumns.id, id));
  return res.rowsAffected ? { ok: true } : fail("Column not found.");
}

// New board order for a group's columns: `ids` must be exactly its columns.
export async function reorderColumns(groupId: string, ids: string[]): Promise<Result> {
  const cols = await listColumns(groupId);
  if (ids.length !== cols.length || !cols.every((c) => ids.includes(c.id))) return fail("Columns changed — refresh and try again.");
  const [first, ...rest] = ids.map((id, position) => db.update(taskColumns).set({ position }).where(eq(taskColumns.id, id)));
  await db.batch([first, ...rest]);
  return { ok: true };
}

// Swap with the neighbour on the left (-1) or right (+1).
export async function moveColumn(id: string, dir: -1 | 1): Promise<Result> {
  const [col] = await db.select().from(taskColumns).where(eq(taskColumns.id, id));
  if (!col) return fail("Column not found.");
  const cols = await listColumns(col.groupId);
  const other = cols[cols.findIndex((c) => c.id === id) + dir];
  if (!other) return { ok: true };
  await db.batch([
    db.update(taskColumns).set({ position: other.position }).where(eq(taskColumns.id, col.id)),
    db.update(taskColumns).set({ position: col.position }).where(eq(taskColumns.id, other.id)),
  ]);
  return { ok: true };
}

// Marking a column as done (or not) re-flags the tasks already in it.
export async function setColumnDone(id: string, done: boolean): Promise<Result> {
  const [res] = await db.batch([
    db.update(taskColumns).set({ done }).where(eq(taskColumns.id, id)),
    db
      .update(tasks)
      .set(done ? { status: "done", completedAt: now() } : { status: "todo", completedAt: null })
      .where(and(eq(tasks.columnId, id), ne(tasks.status, done ? "done" : "todo"))),
  ]);
  return res.rowsAffected ? { ok: true } : fail("Column not found.");
}

// A board keeps at least one column; tasks in a deleted column move to the
// first remaining one (and take its done/not-done state).
export async function deleteColumn(id: string): Promise<Result> {
  const [col] = await db.select().from(taskColumns).where(eq(taskColumns.id, id));
  if (!col) return fail("Column not found.");
  const to = (await listColumns(col.groupId)).find((c) => c.id !== id);
  if (!to) return fail("A board needs at least one column.");
  await db.batch([
    db
      .update(tasks)
      .set({ columnId: to.id, status: to.done ? "done" : "todo", completedAt: to.done ? now() : null })
      .where(eq(tasks.columnId, id)),
    db.delete(taskColumns).where(eq(taskColumns.id, id)),
  ]);
  return { ok: true };
}

// ---------- tasks ----------

// Top-level tasks (one group, or all groups) with their subtasks, labels and
// notes: open ones by due date (undated last), then done ones, most recently
// finished first. `labelId` narrows to tasks wearing that label.
export async function listTasks(groupId?: string, labelId?: string) {
  const all = await db
    .select()
    .from(tasks)
    .where(groupId ? eq(tasks.groupId, groupId) : undefined)
    .orderBy(
      sql`case when ${tasks.status} = 'done' then 1 else 0 end`,
      sql`case when ${tasks.status} = 'done' then null else coalesce(${tasks.due} || ' ' || coalesce(${tasks.dueTime}, '99:99'), '9999') end`,
      sql`${tasks.completedAt} desc`,
      asc(tasks.createdAt),
    );
  const ids = all.map((t) => t.id);
  const [notes, tagged] = ids.length
    ? await Promise.all([
        db.select().from(taskNotes).where(inArray(taskNotes.taskId, ids)).orderBy(asc(taskNotes.createdAt)),
        db
          .select({ taskId: taskLabels.taskId, id: labels.id, name: labels.name, color: labels.color })
          .from(taskLabels)
          .innerJoin(labels, eq(labels.id, taskLabels.labelId))
          .where(inArray(taskLabels.taskId, ids))
          .orderBy(asc(labels.name)),
      ])
    : [[], []];
  const subs = all.filter((t) => t.parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return all
    .filter((t) => !t.parentId)
    .map((t) => ({
      ...t,
      notes: notes.filter((n) => n.taskId === t.id),
      labels: tagged.filter((l) => l.taskId === t.id).map(({ id, name, color }) => ({ id, name, color })),
      subtasks: subs.filter((s) => s.parentId === t.id).map(({ id, title, status }) => ({ id, title, status })),
    }))
    .filter((t) => !labelId || t.labels.some((l) => l.id === labelId));
}
export type TaskFull = Awaited<ReturnType<typeof listTasks>>[number];

// A subtask joins its parent's group; subtasks can't have subtasks. New
// top-level tasks go to `columnId` (added from a board column) or else the
// group's first not-done column.
export async function createTask(input: unknown): Promise<Result<{ id: string }>> {
  const p = taskSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const { parentId, columnId, ...t } = p.data;
  if (parentId) {
    const [parent] = await db.select({ groupId: tasks.groupId, parentId: tasks.parentId }).from(tasks).where(eq(tasks.id, parentId));
    if (!parent) return fail("Task not found.");
    if (parent.parentId) return fail("Subtasks can't have their own subtasks.");
    const [row] = await db.insert(tasks).values({ ...t, groupId: parent.groupId, parentId }).returning({ id: tasks.id });
    return { ok: true, id: row.id };
  }
  if (!(await getGroup(t.groupId))) return fail("Group not found.");
  const cols = await listColumns(t.groupId);
  const start = columnId ? cols.find((c) => c.id === columnId) : (cols.find((c) => !c.done) ?? cols[0]);
  if (columnId && !start) return fail("Column not found.");
  const done = start?.done ?? false;
  const [row] = await db
    .insert(tasks)
    .values({ ...t, columnId: start?.id ?? null, status: done ? "done" : "todo", completedAt: done ? now() : null })
    .returning({ id: tasks.id });
  return { ok: true, id: row.id };
}

export async function getTask(id: string) {
  const [t] = await db.select().from(tasks).where(eq(tasks.id, id));
  return t ?? null;
}

// Status and column move together: a task in a "done" column is done.
// Ticking a top-level task moves it to the first done column (unticking: to
// the first open one); with no such column it is just flagged. Subtasks only
// toggle. A changed reminder will fire again. Completing a repeating task rolls
// it forward instead (see below) rather than finishing it.
export async function updateTask(id: string, input: unknown): Promise<Result> {
  const p = taskPatchSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const [cur] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!cur) return fail("Task not found.");
  const { status, columnId, ...rest } = p.data;
  const patch: Partial<typeof tasks.$inferInsert> = { ...rest, updatedAt: now() };
  if (rest.remindAt !== undefined) patch.remindedAt = null;

  let done = status ? status === "done" : undefined;
  const cols = !cur.parentId && (columnId || status) ? await listColumns(cur.groupId) : null;
  if (cols) {
    const target = columnId ? cols.find((c) => c.id === columnId) : cols.find((c) => c.done === done);
    if (columnId && !target) return fail("Column not found.");
    if (target) {
      patch.columnId = target.id;
      done = target.done;
    }
  }

  // A recurring top-level task doesn't finish when completed — it rolls to its
  // next due date (skipping wholly-missed intervals), reschedules its reminder
  // by the same number of days, resets its subtasks, and returns to an open
  // column. `repeatEvery` is unchanged unless this call also edits it.
  const repeat = rest.repeatEvery !== undefined ? rest.repeatEvery : cur.repeatEvery;
  if (done && !cur.parentId && repeat) {
    const t = today();
    let next = addDays(cur.due ?? t, repeat);
    while (next < t) next = addDays(next, repeat);
    const dayMs = 86_400_000;
    patch.status = "todo";
    patch.completedAt = null;
    patch.due = next;
    patch.remindedAt = null;
    patch.remindAt = cur.remindAt && cur.due ? new Date(Date.parse(cur.remindAt) + Math.round((Date.parse(next) - Date.parse(cur.due)) / dayMs) * dayMs).toISOString() : null;
    patch.columnId = (cols ?? (await listColumns(cur.groupId))).find((c) => !c.done)?.id ?? cur.columnId;
    await db.batch([
      db.update(tasks).set(patch).where(eq(tasks.id, id)),
      db.update(tasks).set({ status: "todo", completedAt: null, updatedAt: now() }).where(eq(tasks.parentId, id)),
    ]);
    return { ok: true };
  }

  if (done !== undefined) {
    patch.status = done ? "done" : "todo";
    patch.completedAt = done ? now() : null;
  }
  await db.update(tasks).set(patch).where(eq(tasks.id, id));
  return { ok: true };
}

export async function deleteTask(id: string): Promise<Result> {
  const ids = db.select({ id: tasks.id }).from(tasks).where(sql`${tasks.id} = ${id} or ${tasks.parentId} = ${id}`);
  const [, , res] = await db.batch([
    db.delete(taskNotes).where(inArray(taskNotes.taskId, ids)),
    db.delete(taskLabels).where(inArray(taskLabels.taskId, ids)),
    db.delete(tasks).where(sql`${tasks.id} = ${id} or ${tasks.parentId} = ${id}`),
  ]);
  return res.rowsAffected ? { ok: true } : fail("Task not found.");
}

// ---------- labels ----------

export const listLabels = () => db.select().from(labels).orderBy(asc(labels.name));

export async function createLabel(input: unknown): Promise<Result<{ id: string }>> {
  const p = labelSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const [dupe] = await db.select({ id: labels.id }).from(labels).where(sql`lower(${labels.name}) = lower(${p.data.name})`);
  if (dupe) return { ok: true, id: dupe.id };
  const [row] = await db.insert(labels).values(p.data).returning({ id: labels.id });
  return { ok: true, id: row.id };
}

export async function updateLabel(id: string, input: unknown): Promise<Result> {
  const p = labelPatchSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const res = await db.update(labels).set(p.data).where(eq(labels.id, id));
  return res.rowsAffected ? { ok: true } : fail("Label not found.");
}

export async function deleteLabel(id: string): Promise<Result> {
  const [, res] = await db.batch([db.delete(taskLabels).where(eq(taskLabels.labelId, id)), db.delete(labels).where(eq(labels.id, id))]);
  return res.rowsAffected ? { ok: true } : fail("Label not found.");
}

export async function setTaskLabel(taskId: string, labelId: string, on: boolean): Promise<Result> {
  if (!on) {
    await db.delete(taskLabels).where(and(eq(taskLabels.taskId, taskId), eq(taskLabels.labelId, labelId)));
    return { ok: true };
  }
  const [[t], [l]] = await Promise.all([
    db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)),
    db.select({ id: labels.id }).from(labels).where(eq(labels.id, labelId)),
  ]);
  if (!t || !l) return fail("Task or label not found.");
  await db.insert(taskLabels).values({ taskId, labelId }).onConflictDoNothing();
  return { ok: true };
}

// ---------- notes ----------

export async function addNote(taskId: string, input: unknown): Promise<Result<{ id: string }>> {
  const p = noteSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const [t] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId));
  if (!t) return fail("Task not found.");
  const [row] = await db.insert(taskNotes).values({ taskId, body: p.data.body }).returning({ id: taskNotes.id });
  return { ok: true, id: row.id };
}

export async function deleteNote(id: string): Promise<Result> {
  const res = await db.delete(taskNotes).where(eq(taskNotes.id, id));
  return res.rowsAffected ? { ok: true } : fail("Note not found.");
}

// ---------- reminders ----------

// Reminders that are due and not yet shown, marked as shown in the same
// statement so two open tabs can't both claim one.
export async function claimDueReminders() {
  const now = new Date().toISOString();
  const due = await db
    .update(tasks)
    .set({ remindedAt: now })
    .where(and(lte(tasks.remindAt, now), isNull(tasks.remindedAt), ne(tasks.status, "done")))
    .returning({ id: tasks.id, title: tasks.title, groupId: tasks.groupId, due: tasks.due, dueTime: tasks.dueTime });
  return due;
}

// Counts across all groups, or one group. "Done this week" = finished in the last 7 days.
export async function taskStats(groupId?: string) {
  const t = today();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const scope = and(topLevel, groupId ? eq(tasks.groupId, groupId) : undefined);
  const n = (w: ReturnType<typeof and>) => db.select({ n: count() }).from(tasks).where(and(scope, w)).then((r) => r[0].n);
  const [open, dueToday, overdue, doneWeek] = await Promise.all([
    n(ne(tasks.status, "done")),
    n(and(ne(tasks.status, "done"), eq(tasks.due, t))),
    n(and(ne(tasks.status, "done"), lt(tasks.due, t))),
    n(and(eq(tasks.status, "done"), gte(tasks.completedAt, weekAgo))),
  ]);
  return { open, dueToday, overdue, doneWeek };
}
