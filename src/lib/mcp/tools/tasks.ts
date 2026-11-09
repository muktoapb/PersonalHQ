import "server-only";
import { z } from "zod";
import { LIST_VIEWS } from "@/db/schema";
import {
  addColumn, addNote, createGroup, createLabel, createTask, deleteColumn, deleteGroup, deleteLabel, deleteNote, deleteTask,
  getTask, listColumns, listGroups, listLabels, listTasks, moveColumn, renameColumn, setColumnDone, setTaskLabel,
  updateGroup, updateLabel, updateTask,
} from "@/lib/core/tasks";
import { GROUP_ICONS } from "@/lib/group-icons";
import { date, id, tool } from "./shared";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/).describe("Hex colour, e.g. #7262ea");
const repeatEvery = z.number().int().min(1).max(30).describe("Repeat every N days (1–30): 1 daily, 7 weekly, 30 ~monthly. Completing it rolls to the next date instead of finishing.");

// Same rule as the task panel: a reminder fires `offset` minutes before the
// due time (09:00 when no time is set); no due date means no reminder.
const remindAt = (due: string | null, time: string | null, offset: number | null) =>
  due && offset !== null ? new Date(new Date(`${due}T${time ?? "09:00"}:00`).getTime() - offset * 60_000).toISOString() : null;

export const taskTools = [
  // ---------- groups ----------
  tool({
    name: "list_task_groups",
    description: "List task groups (projects/areas). Every task belongs to one group.",
    input: z.object({}),
    run: async () => (await listGroups()).map(({ id, name, color, icon, view }) => ({ id, name, color, icon, view })),
  }),
  tool({
    name: "create_task_group",
    description: "Create a task group. It starts with To do / Doing / Done board columns.",
    write: true,
    input: z.object({ name: z.string(), color: color.optional(), icon: z.enum(GROUP_ICONS).optional(), view: z.enum(LIST_VIEWS).optional().describe("Shown as a list or a board") }),
    run: (args) => createGroup(args),
  }),
  tool({
    name: "update_task_group",
    description: "Rename a task group or change its colour, icon or view.",
    write: true,
    input: z.object({ id: id("Task group"), name: z.string().optional(), color: color.optional(), icon: z.enum(GROUP_ICONS).optional(), view: z.enum(LIST_VIEWS).optional() }),
    run: ({ id, ...patch }) => updateGroup(id, patch),
  }),
  tool({
    name: "delete_task_group",
    description: "Permanently delete a task group with all its tasks, notes and columns.",
    write: true,
    input: z.object({ id: id("Task group") }),
    run: ({ id }) => deleteGroup(id),
  }),

  // ---------- board columns ----------
  tool({
    name: "list_board_columns",
    description: "A group's board columns in order. Tasks in a 'done' column count as finished.",
    input: z.object({ groupId: id("Task group") }),
    run: async ({ groupId }) => (await listColumns(groupId)).map(({ id, name, done }) => ({ id, name, done })),
  }),
  tool({
    name: "add_board_column",
    description: "Add a column to a group's board (placed before the first done column).",
    write: true,
    input: z.object({ groupId: id("Task group"), name: z.string() }),
    run: ({ groupId, name }) => addColumn(groupId, { name }),
  }),
  tool({
    name: "update_board_column",
    description: "Rename a column, mark it as a done column (or not), or move it one place left (-1) or right (1).",
    write: true,
    input: z.object({ id: id("Column"), name: z.string().optional(), done: z.boolean().optional(), move: z.union([z.literal(-1), z.literal(1)]).optional() }),
    run: async ({ id, name, done, move }) => {
      for (const step of [
        name !== undefined && (() => renameColumn(id, { name })),
        done !== undefined && (() => setColumnDone(id, done)),
        move !== undefined && (() => moveColumn(id, move)),
      ]) {
        if (!step) continue;
        const r = await step();
        if (!r.ok) return r;
      }
      return { ok: true };
    },
  }),
  tool({
    name: "delete_board_column",
    description: "Delete a column; its tasks move to the first remaining column. A board keeps at least one.",
    write: true,
    input: z.object({ id: id("Column") }),
    run: ({ id }) => deleteColumn(id),
  }),

  // ---------- tasks ----------
  tool({
    name: "list_tasks",
    description: "List top-level tasks with their subtasks, labels and notes. Open tasks come first, by due date.",
    input: z.object({
      groupId: id("Task group").optional().describe("Only this group; all groups when left out"),
      labelId: id("Label").optional().describe("Only tasks with this label"),
      includeDone: z.boolean().default(false).describe("Also return finished tasks"),
    }),
    run: async ({ groupId, labelId, includeDone }) =>
      (await listTasks(groupId, labelId))
        .filter((t) => includeDone || t.status !== "done")
        .map((t) => ({
          id: t.id,
          groupId: t.groupId,
          columnId: t.columnId,
          title: t.title,
          status: t.status,
          due: t.due,
          dueTime: t.dueTime,
          remindMinutesBefore: t.remindOffset,
          repeatEvery: t.repeatEvery,
          labels: t.labels.map(({ id, name }) => ({ id, name })),
          subtasks: t.subtasks,
          notes: t.notes.map(({ id, body }) => ({ id, body })),
        })),
  }),
  tool({
    name: "create_task",
    description: "Add a task to a group, or a subtask under a task (parentId). Use list_task_groups for group ids.",
    write: true,
    input: z.object({
      groupId: id("Task group"),
      title: z.string(),
      due: date.optional(),
      repeatEvery: repeatEvery.optional(),
      parentId: id("Parent task").optional().describe("Makes this a subtask"),
      columnId: id("Column").optional().describe("Board column to start in; defaults to the first open one"),
    }),
    run: (args) => createTask(args),
  }),
  tool({
    name: "update_task",
    description:
      "Change a task: rename it, mark it done/todo, move it to a board column, set or clear (null) its due date and time, set a reminder (minutes before the due time; 09:00 when no time), or set/clear (null) a repeat interval. Moving to a done column finishes it — unless it repeats, in which case it rolls to its next date.",
    write: true,
    input: z.object({
      id: id("Task"),
      title: z.string().optional(),
      status: z.enum(["todo", "done"]).optional(),
      columnId: id("Column").optional(),
      due: date.nullable().optional(),
      dueTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional().describe("HH:MM"),
      remindMinutesBefore: z.number().int().min(0).max(60 * 24 * 7).nullable().optional().describe("e.g. 0, 15, 60, 1440; null removes the reminder"),
      repeatEvery: repeatEvery.nullable().optional().describe("null stops it repeating"),
    }),
    run: async ({ id, remindMinutesBefore, ...patch }) => {
      const timing = patch.due !== undefined || patch.dueTime !== undefined || remindMinutesBefore !== undefined;
      if (!timing) return updateTask(id, patch);
      const cur = await getTask(id);
      if (!cur) return { ok: false, error: "Task not found." };
      const next = { due: cur.due, dueTime: cur.dueTime, remindOffset: cur.remindOffset, ...patch };
      if (remindMinutesBefore !== undefined) next.remindOffset = remindMinutesBefore;
      if (!next.due) {
        if (remindMinutesBefore != null) return { ok: false, error: "Set a due date before adding a reminder." };
        next.remindOffset = null;
      }
      return updateTask(id, { ...patch, ...next, remindAt: remindAt(next.due, next.dueTime, next.remindOffset) });
    },
  }),
  tool({
    name: "delete_task",
    description: "Permanently delete a task and its subtasks and notes.",
    write: true,
    input: z.object({ id: id("Task") }),
    run: ({ id }) => deleteTask(id),
  }),
  tool({
    name: "add_task_note",
    description: "Attach a note to a task.",
    write: true,
    input: z.object({ taskId: id("Task"), body: z.string() }),
    run: ({ taskId, body }) => addNote(taskId, { body }),
  }),
  tool({
    name: "delete_task_note",
    description: "Delete a note attached to a task (ids come from list_tasks).",
    write: true,
    input: z.object({ id: id("Task note") }),
    run: ({ id }) => deleteNote(id),
  }),

  // ---------- labels ----------
  tool({
    name: "list_labels",
    description: "List task labels.",
    input: z.object({}),
    run: async () => (await listLabels()).map(({ id, name, color }) => ({ id, name, color })),
  }),
  tool({
    name: "create_label",
    description: "Create a label (returns the existing one if the name is taken).",
    write: true,
    input: z.object({ name: z.string(), color: color.optional() }),
    run: (args) => createLabel(args),
  }),
  tool({
    name: "update_label",
    description: "Rename or recolour a label.",
    write: true,
    input: z.object({ id: id("Label"), name: z.string().optional(), color: color.optional() }),
    run: ({ id, ...patch }) => updateLabel(id, patch),
  }),
  tool({
    name: "delete_label",
    description: "Delete a label and remove it from every task.",
    write: true,
    input: z.object({ id: id("Label") }),
    run: ({ id }) => deleteLabel(id),
  }),
  tool({
    name: "set_task_label",
    description: "Put a label on a task (on: true) or take it off (on: false).",
    write: true,
    input: z.object({ taskId: id("Task"), labelId: id("Label"), on: z.boolean() }),
    run: ({ taskId, labelId, on }) => setTaskLabel(taskId, labelId, on),
  }),
];
