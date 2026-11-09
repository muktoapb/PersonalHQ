"use client";

import { ArrowLeft, ArrowRight, ArrowsClockwise, ArrowsLeftRight, Bell, CalendarBlank, ChatText, Check, CheckCircle, CheckSquare, DotsSixVertical, DotsThree, Kanban, ListChecks, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react/ssr";
import { haptic } from "@/lib/haptics";
import { SectionFilterButton } from "./AppShell";
import Link from "next/link";
import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import type { Label, ListView, TaskColumn } from "@/db/schema";
import {
  addColumnAction,
  addNoteAction,
  addSubtaskAction,
  createLabelAction,
  createTaskAction,
  deleteColumnAction,
  deleteLabelAction,
  deleteNoteAction,
  deleteTaskAction,
  addTaskToColumnAction,
  moveColumnAction,
  renameColumnAction,
  reorderColumnsAction,
  setColumnDoneAction,
  setGroupViewAction,
  setTaskLabelAction,
  updateTaskAction,
} from "@/lib/actions/tasks";
import type { TaskFull } from "@/lib/core/tasks";
import { GROUP_COLORS, type GroupIcon } from "@/lib/group-icons";
import { AppIcon } from "./AppIcon";
import { GroupDialog } from "./TaskGroups";

type GroupInfo = { id: string; name: string; color: string; icon: GroupIcon };
// Where a task goes: a board column, or done/not done (the group's first matching column).
type Target = { columnId: string } | { done: boolean };
type Move = (id: string, to: Target) => void;
const REMINDERS: { value: number | null; label: string }[] = [
  { value: null, label: "No reminder" },
  { value: 0, label: "At due time" },
  { value: 10, label: "10 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
];

// "Every day" / "Every 7 days (weekly)" … for a repeat interval in days.
const repeatLabel = (n: number) =>
  n === 1 ? "Every day" : `Every ${n} days${n === 7 ? " (weekly)" : n === 14 ? " (fortnightly)" : n === 30 ? " (monthly)" : ""}`;

// "YYYY-MM-DD" -> "Nov 5", built from parts so server and browser agree.
const shortDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// The reminder's moment in the browser's time zone (undated tasks: none;
// no time: 9:00 that day).
const remindAt = (due: string | null, time: string | null, offset: number | null) =>
  due && offset !== null ? new Date(new Date(`${due}T${time ?? "09:00"}:00`).getTime() - offset * 60_000).toISOString() : null;

export function DueChip({ due, time, today, done }: { due: string | null; time?: string | null; today: string; done: boolean }) {
  if (!due) return null;
  const late = !done && due < today;
  const tone = done ? "text-ink-3" : late ? "text-danger" : due === today ? "text-accent-text font-medium" : "text-ink-3";
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      <CalendarBlank size={12} weight="bold" aria-hidden />
      {due === today ? "Today" : late ? `Overdue · ${shortDate(due)}` : shortDate(due)}
      {time && ` ${time}`}
    </span>
  );
}

// Column badge, labels, subtask progress, reminder and notes under a task's title.
function Meta({ t, today, badge }: { t: TaskFull; today: string; badge?: string }) {
  const doneSubs = t.subtasks.filter((s) => s.status === "done").length;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs empty:hidden">
      {badge && <span className="rounded-full bg-accent-soft px-2 text-accent-text">{badge}</span>}
      <DueChip due={t.due} time={t.dueTime} today={today} done={t.status === "done"} />
      {t.remindAt && t.status !== "done" && <Bell size={12} weight="bold" className="text-ink-3" aria-label="Reminder set" />}
      {t.repeatEvery && <ArrowsClockwise size={12} weight="bold" className="text-ink-3" aria-label={repeatLabel(t.repeatEvery)} />}
      {t.subtasks.length > 0 && (
        <span className="inline-flex items-center gap-1 text-ink-3"><CheckSquare size={12} weight="bold" aria-hidden /> {doneSubs}/{t.subtasks.length}</span>
      )}
      {t.notes.length > 0 && (
        <span className="inline-flex items-center gap-1 text-ink-3"><ChatText size={12} weight="bold" aria-hidden /> {t.notes.length}<span className="sr-only"> notes</span></span>
      )}
      {t.labels.map((l) => (
        <span key={l.id} className="inline-flex items-center gap-1 rounded-full px-2 py-px text-ink-2" style={{ background: `color-mix(in oklab, ${l.color} 16%, transparent)` }}>
          <span className="size-1.5 rounded-full" style={{ background: l.color }} aria-hidden /> {l.name}
        </span>
      ))}
    </span>
  );
}

// Group page header: icon and name, list/board switch, edit, label filter.
export function GroupHeader({ group, labels, labelId }: {
  group: { id: string; name: string; color: string; icon: GroupIcon; view: ListView };
  labels: Label[];
  labelId?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-0 sm:flex-1">
          <span className="hidden lg:block"><AppIcon name={group.icon} size={48} color={group.color} /></span>
          <h1 className="min-w-0 truncate text-3xl font-semibold">{group.name}</h1>
          <SectionFilterButton label="Task groups" />
        </div>
        <div className="seg" role="group" aria-label="Show as">
          {(["list", "board"] as const).map((v) => (
            <button
              key={v}
              disabled={pending}
              onClick={() => v !== group.view && start(async () => { await setGroupViewAction(group.id, v); })}
              aria-pressed={group.view === v}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-medium ${group.view === v ? "bg-accent-strong text-white" : "text-ink-3 hover:text-ink"}`}
            >
              {v === "list" ? <ListChecks size={16} /> : <Kanban size={16} />} {v === "list" ? "List" : "Board"}
            </button>
          ))}
        </div>
        <GroupDialog group={group} trigger="edit" />
      </div>
      {labels.length > 0 && (
        <nav aria-label="Filter by label" className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <Link href="?" className={`shrink-0 rounded-full border px-3 py-1 text-xs ${!labelId ? "border-accent bg-accent-soft font-medium" : "border-rule bg-surface text-ink-2"}`}>All</Link>
          {labels.map((l) => (
            <Link
              key={l.id}
              href={labelId === l.id ? "?" : `?label=${l.id}`}
              aria-current={labelId === l.id ? "true" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${labelId === l.id ? "border-accent bg-accent-soft font-medium" : "border-rule bg-surface text-ink-2"}`}
            >
              <span className="size-2 rounded-full" style={{ background: l.color }} aria-hidden /> {l.name}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

// Quick add. On a group page the group is fixed; on All tasks pick one.
export function AddTaskForm({ groupId, groups }: { groupId?: string; groups?: GroupInfo[] }) {
  const [state, action, pending] = useActionState(createTaskAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      const keep = form.current?.querySelector<HTMLSelectElement>("select[name=groupId]")?.value;
      form.current?.reset();
      const sel = form.current?.querySelector<HTMLSelectElement>("select[name=groupId]");
      if (sel && keep) sel.value = keep; // stay on the group just used
      form.current?.querySelector<HTMLInputElement>("input[name=title]")?.focus();
    }
  }, [state]);
  return (
    <form ref={form} action={action} className="card flex flex-wrap items-center gap-2 p-3 sm:p-3">
      {groupId && <input type="hidden" name="groupId" value={groupId} />}
      <input name="title" required maxLength={300} placeholder="Add a task…" aria-label="New task" className="input min-w-0 flex-1 basis-full border-transparent bg-transparent focus:border-accent sm:basis-48" />
      {groups && (
        <select name="groupId" required aria-label="Group" className="input w-auto max-w-[45%] flex-1 py-2 sm:max-w-none sm:flex-none">
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}
      <input name="due" type="date" aria-label="Due date (optional)" className="input w-auto py-2" />
      <button disabled={pending} className="btn btn-primary">Add</button>
      {state.error && <p role="alert" className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}

// Tasks as a checklist, a board of the group's columns, or (view "all") every
// task grouped by when it's due. Moves show instantly (optimistic) while the
// server catches up; a task opens in a panel with its details.
export function TaskView({ tasks, view, columns, groups, today, locale, labels }: {
  tasks: TaskFull[];
  view: ListView | "all";
  columns: TaskColumn[];
  groups?: GroupInfo[];
  today: string;
  locale: string;
  labels: Label[];
}) {
  const [items, apply] = useOptimistic(tasks, (cur, { id, to }: { id: string; to: Target }) =>
    cur.map((t) => {
      if (t.id !== id) return t;
      const col = "columnId" in to ? columns.find((c) => c.id === to.columnId) : columns.find((c) => c.groupId === t.groupId && c.done === to.done);
      const done = col ? col.done : "done" in to && to.done;
      return { ...t, columnId: col?.id ?? t.columnId, status: done ? ("done" as const) : ("todo" as const) };
    }),
  );
  const [, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const move: Move = (id, to) =>
    start(async () => {
      haptic();
      apply({ id, to });
      await updateTaskAction(id, "columnId" in to ? { columnId: to.columnId } : { status: to.done ? "done" : "todo" });
    });
  // A column name worth showing on a row: not the group's first column, not done.
  const badge = (t: TaskFull) => {
    const col = columns.find((c) => c.id === t.columnId);
    const first = columns.find((c) => c.groupId === t.groupId);
    return col && !col.done && col.id !== first?.id ? col.name : undefined;
  };
  const selected = items.find((t) => t.id === openId) ?? null;
  const props = { today, move, openTask: setOpenId, badge };

  return (
    <>
      {view === "board" ? (
        <Board items={items} columns={columns} {...props} />
      ) : view === "all" ? (
        <AllTasks items={items} groups={groups ?? []} {...props} />
      ) : (
        <Checklist items={items} {...props} />
      )}
      <TaskSheet task={selected} today={today} locale={locale} labels={labels} columns={columns.filter((c) => c.groupId === selected?.groupId)} move={move} onClose={() => setOpenId(null)} />
    </>
  );
}

type ViewProps = { items: TaskFull[]; today: string; move: Move; openTask: (id: string) => void; badge: (t: TaskFull) => string | undefined };

function TaskRow({ t, today, move, openTask, badge, group }: Omit<ViewProps, "items"> & { t: TaskFull; group?: GroupInfo }) {
  const isDone = t.status === "done";
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-rule bg-surface px-3 py-2.5 transition hover:border-accent/40">
      <button
        onClick={() => move(t.id, { done: !isDone })}
        role="checkbox"
        aria-checked={isDone}
        aria-label={`${t.title}: mark ${isDone ? "not done" : "done"}`}
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
          isDone ? "border-accent-strong bg-accent-strong text-white" : "border-rule hover:border-accent"
        }`}
      >
        {isDone && <Check size={13} weight="bold" />}
      </button>
      <button onClick={() => openTask(t.id)} className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-sm ${isDone ? "text-ink-3 line-through" : "font-medium"}`}>{t.title}</span>
        <Meta t={t} today={today} badge={badge(t)} />
      </button>
      {group && (
        <span className="mt-0.5 inline-flex max-w-[35%] shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs text-ink-2" style={{ background: `color-mix(in oklab, ${group.color} 14%, transparent)` }}>
          <AppIcon.Glyph name={group.icon} size={12} weight="regular" />
          <span className="truncate">{group.name}</span>
        </span>
      )}
    </li>
  );
}

function Completed({ list, children }: { list: TaskFull[]; children: (t: TaskFull) => React.ReactNode }) {
  if (!list.length) return null;
  return (
    <details>
      <summary className="cursor-pointer select-none py-1 text-sm font-medium text-ink-2">Completed ({list.length})</summary>
      <ul className="mt-2 space-y-2">{list.map(children)}</ul>
    </details>
  );
}

function Checklist({ items, ...p }: ViewProps) {
  const open = items.filter((t) => t.status !== "done");
  if (!items.length) return <p className="card py-10 text-center text-sm text-ink-3">No tasks here yet — add the first one above.</p>;
  return (
    <div className="space-y-4">
      {open.length ? <ul className="space-y-2">{open.map((t) => <TaskRow key={t.id} t={t} {...p} />)}</ul> : <p className="py-4 text-center text-sm text-ink-3">All done here.</p>}
      <Completed list={items.filter((t) => t.status === "done")}>{(t) => <TaskRow key={t.id} t={t} {...p} />}</Completed>
    </div>
  );
}

// Every open task across groups, sectioned by due date.
function AllTasks({ items, groups, ...p }: ViewProps & { groups: GroupInfo[] }) {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const open = items.filter((t) => t.status !== "done");
  const in7 = (() => {
    const [y, m, d] = p.today.split("-").map(Number);
    const x = new Date(y, m - 1, d + 7);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  })();
  const sections: [string, TaskFull[]][] = [
    ["Overdue", open.filter((t) => t.due && t.due < p.today)],
    ["Today", open.filter((t) => t.due === p.today)],
    ["Next 7 days", open.filter((t) => t.due && t.due > p.today && t.due <= in7)],
    ["Later", open.filter((t) => t.due && t.due > in7)],
    ["No date", open.filter((t) => !t.due)],
  ];
  if (!items.length) return <p className="card py-10 text-center text-sm text-ink-3">No tasks yet — add one above.</p>;
  const row = (t: TaskFull) => <TaskRow key={t.id} t={t} group={byId.get(t.groupId)} {...p} />;
  return (
    <div className="space-y-6">
      {sections.map(([name, list]) =>
        list.length ? (
          <section key={name} id={name.toLowerCase().replace(/\s+/g, "-")} className="scroll-mt-4 space-y-2">
            <h2 className={`sticky-heading px-1 text-sm font-medium ${name === "Overdue" ? "text-danger" : "text-ink-2"}`}>
              {name} <span className="text-ink-3">· {list.length}</span>
            </h2>
            <ul className="space-y-2">{list.map(row)}</ul>
          </section>
        ) : null,
      )}
      {!open.length && <p className="py-4 text-center text-sm text-ink-3">All done.</p>}
      <Completed list={items.filter((t) => t.status === "done")}>{row}</Completed>
    </div>
  );
}

// The group's own columns. Drag cards between columns, and drag a column by
// its header to reorder (mouse). Each column has a quick "Add task" at the
// bottom and a menu (rename, counts as done, delete; move left/right on phones,
// where dragging isn't available).
//
// Phones and tablets: one column per screen with the next one peeking, a
// sticky strip of column tabs (with counts) that follows the swipe, and a
// move button on each card in place of dragging.
function Board({ items, columns, ...p }: ViewProps & { columns: TaskColumn[] }) {
  const [order, reorder] = useOptimistic(columns, (cur, ids: string[]) => ids.map((id) => cur.find((c) => c.id === id)!).filter(Boolean));
  const [over, setOver] = useState<string | null>(null); // column under a dragged task
  const [dragCol, setDragCol] = useState<string | null>(null); // column being dragged
  const [, start] = useTransition();
  const [active, setActive] = useState(0); // column in view (phones)
  const [moving, setMoving] = useState<string | null>(null); // task in the move sheet
  const scroller = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const groupId = columns[0]?.groupId;

  const columnEls = () => [...(scroller.current?.querySelectorAll<HTMLElement>(":scope > section") ?? [])];
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const left = el.scrollLeft + el.clientWidth * 0.3;
    const i = Math.max(0, columnEls().findLastIndex((s) => s.offsetLeft <= left));
    if (i === active) return;
    setActive(i);
    tabs.current?.children[i]?.scrollIntoView({ inline: "nearest", block: "nearest" });
  };
  const goTo = (i: number) => columnEls()[i]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });

  const dropColumn = (target: string) => {
    if (!dragCol || dragCol === target || !groupId) return;
    const ids = order.map((c) => c.id);
    const from = ids.indexOf(dragCol), to = ids.indexOf(target);
    ids.splice(from, 1);
    ids.splice(to, 0, dragCol);
    start(async () => {
      reorder(ids);
      await reorderColumnsAction(groupId, ids);
    });
  };

  const movingTask = items.find((t) => t.id === moving) ?? null;
  return (
    <div>
    {order.length > 1 && (
      <div
        ref={tabs}
        role="tablist"
        aria-label="Columns"
        className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-3 mb-3 flex gap-1.5 overflow-x-auto bg-app/85 px-3 py-2 backdrop-blur-xl [scrollbar-width:none] lg:hidden"
      >
        {order.map((c, i) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={active === i}
            onClick={() => goTo(i)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
              active === i ? "bg-accent-strong font-medium text-white" : "bg-surface text-ink-2"
            }`}
          >
            {c.done && <CheckCircle size={14} weight="fill" className={active === i ? "" : "text-income"} aria-hidden />}
            {c.name}
            <span className={`tabular-nums text-xs ${active === i ? "text-white/80" : "text-ink-3"}`}>{items.filter((t) => t.columnId === c.id).length}</span>
          </button>
        ))}
      </div>
    )}
    <div ref={scroller} onScroll={onScroll} className="-mx-3 flex snap-x snap-mandatory scroll-px-3 items-start gap-3 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 lg:snap-none">
      {order.map((c, i) => {
        const col = items.filter((t) => t.columnId === c.id);
        const columnDrag = dragCol !== null;
        return (
          <section
            key={c.id}
            aria-label={c.name}
            onDragOver={(e) => { e.preventDefault(); setOver(c.id); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (columnDrag) return dropColumn(c.id);
              const id = e.dataTransfer.getData("text/task");
              if (id && items.find((t) => t.id === id)?.columnId !== c.id) p.move(id, { columnId: c.id });
            }}
            className={`flex w-[calc(100%-2.25rem)] shrink-0 snap-start flex-col gap-2 rounded-[24px] bg-surface-2 p-3 transition sm:w-72 ${
              dragCol === c.id ? "opacity-40" : ""
            } ${over === c.id && !(columnDrag && dragCol === c.id) ? "ring-2 ring-accent" : ""}`}
          >
            <ColumnHeader
              column={c}
              count={col.length}
              first={i === 0}
              last={i === order.length - 1}
              only={order.length === 1}
              firstName={order.find((x) => x.id !== c.id)?.name}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/column", c.id);
                e.dataTransfer.effectAllowed = "move";
                const section = e.currentTarget.closest("section");
                if (section) e.dataTransfer.setDragImage(section, 24, 24);
                setDragCol(c.id);
              }}
              onDragEnd={() => { setDragCol(null); setOver(null); }}
            />
            {col.map((t) => (
              <div key={t.id} className="relative">
                <button
                  draggable
                  onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/task", t.id); e.dataTransfer.effectAllowed = "move"; }}
                  onClick={() => p.openTask(t.id)}
                  className="w-full cursor-grab rounded-2xl border border-rule bg-surface p-3 pr-12 text-left shadow-sm transition hover:border-accent/40 hover:shadow-md active:cursor-grabbing lg:pr-3"
                >
                  <span className={`block text-sm ${t.status === "done" ? "text-ink-3 line-through" : "font-medium"}`}>{t.title}</span>
                  <Meta t={t} today={p.today} />
                </button>
                {order.length > 1 && (
                  <button
                    onClick={() => { haptic(); setMoving(t.id); }}
                    aria-label={`Move “${t.title}” to another column`}
                    className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full text-ink-3 transition active:bg-surface-2 lg:hidden"
                  >
                    <ArrowsLeftRight size={17} />
                  </button>
                )}
              </div>
            ))}
            {!col.length && (
              <p className="rounded-2xl border border-dashed border-rule px-3 py-6 text-center text-xs text-ink-3">No tasks</p>
            )}
            {groupId && <ColumnQuickAdd groupId={groupId} columnId={c.id} />}
          </section>
        );
      })}
      {groupId && <AddColumn groupId={groupId} />}
    </div>
    <MoveSheet
      task={movingTask}
      columns={order}
      onMove={(columnId) => movingTask && movingTask.columnId !== columnId && p.move(movingTask.id, { columnId })}
      onClose={() => setMoving(null)}
    />
    </div>
  );
}

// Phones: "Move to…" for a card, a sheet listing the group's columns.
function MoveSheet({ task, columns, onMove, onClose }: {
  task: TaskFull | null; columns: TaskColumn[]; onMove: (columnId: string) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (task && d && !d.open) d.showModal();
    if (!task && d?.open) d.close();
  }, [task]);
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      aria-label="Move to"
      className="sheet mx-0 mb-0 mt-auto w-full max-w-full rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink backdrop:bg-black/40"
    >
      {task && (
        <div className="space-y-3">
          <div>
            <p className="label">Move to</p>
            <p className="truncate font-medium">{task.title}</p>
          </div>
          <ul className="space-y-1">
            {columns.map((c) => {
              const here = task.columnId === c.id;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => { onMove(c.id); dialog.current?.close(); }}
                    aria-current={here || undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${here ? "bg-accent-soft font-medium" : "active:bg-surface-2"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {c.done && <CheckCircle size={16} weight="fill" className="text-income" aria-label="Counts as done" />}
                    {here && <Check size={16} weight="bold" className="text-accent-text" aria-label="Current column" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </dialog>
  );
}

// "+ Add task" at the bottom of a column: Enter adds and keeps the field open
// for the next one; Escape (or leaving it empty) closes it.
function ColumnQuickAdd({ groupId, columnId }: { groupId: string; columnId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-sm text-ink-3 transition hover:bg-surface hover:text-ink">
        <Plus size={14} weight="bold" /> Add task
      </button>
    );
  return (
    <form
      action={(fd) => {
        const title = String(fd.get("title") ?? "").trim();
        if (!title) return setOpen(false);
        start(async () => {
          const r = await addTaskToColumnAction(groupId, columnId, title);
          setError(r.error);
          if (!r.error && input.current) {
            input.current.value = "";
            input.current.focus();
          }
        });
      }}
      className="rounded-2xl border border-accent/50 bg-surface p-2 shadow-sm"
    >
      <input
        ref={input}
        name="title"
        autoFocus
        maxLength={300}
        placeholder="Task title, then Enter"
        aria-label="New task in this column"
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        onBlur={(e) => !e.target.value.trim() && !pending && setOpen(false)}
        className="w-full bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-ink-3"
      />
      {error && <p role="alert" className="px-1.5 text-xs text-danger">{error}</p>}
      <div className="mt-1 flex items-center gap-1">
        <button disabled={pending} className="btn btn-primary px-3 py-1 text-xs">{pending ? "Adding…" : "Add"}</button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cancel" className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2"><X size={14} /></button>
      </div>
    </form>
  );
}

// Column header: drag handle (whole header), name (click to rename), done
// badge, count, and a settings menu.
function ColumnHeader({ column: c, count, first, last, only, firstName, onDragStart, onDragEnd }: {
  column: TaskColumn;
  count: number;
  first: boolean;
  last: boolean;
  only: boolean;
  firstName?: string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  // Menu position in the viewport: the board scrolls sideways and would clip it.
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const run = (fn: () => Promise<{ error?: string }>, close = true) =>
    start(async () => {
      const r = await fn();
      setError(r.error);
      if (close && !r.error) setMenu(null);
    });

  // Close the menu on a click outside or Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [menu]);
  const toggleMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu(menu ? null : { top: r.bottom + 8, left: Math.max(8, Math.min(r.right - 256, window.innerWidth - 264)) });
    setConfirmDelete(false);
  };

  const item = "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-surface-2 disabled:opacity-50";
  return (
    <div ref={box} className="relative">
      <div
        draggable={!renaming}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className="group/h flex cursor-grab items-center gap-1.5 rounded-xl px-1 py-0.5 active:cursor-grabbing"
      >
        <DotsSixVertical size={16} weight="bold" className="hidden shrink-0 text-ink-3 opacity-0 transition group-hover/h:opacity-100 md:block" aria-hidden />
        {renaming ? (
          <input
            autoFocus
            defaultValue={c.name}
            maxLength={40}
            aria-label="Column name"
            onBlur={(e) => {
              const v = e.target.value.trim();
              setRenaming(false);
              if (v && v !== c.name) run(() => renameColumnAction(c.id, v));
            }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setRenaming(false); }}
            className="input min-w-0 flex-1 cursor-text py-1 text-sm"
          />
        ) : (
          <button onClick={() => setRenaming(true)} title="Click to rename · drag to move" className="min-w-0 flex-1 cursor-grab truncate text-left text-sm font-medium hover:text-accent-text">
            {c.name}
          </button>
        )}
        {c.done && <CheckCircle size={15} weight="fill" className="shrink-0 text-income" aria-label="Counts as done" />}
        <span className="rounded-full bg-surface px-2 text-xs tabular-nums text-ink-3">{count}</span>
        <button onClick={toggleMenu} aria-label={`${c.name} column settings`} aria-expanded={!!menu} className={`rounded-full p-1 transition hover:bg-surface hover:text-ink ${menu ? "bg-surface text-ink" : "text-ink-3"}`}>
          <DotsThree size={18} weight="bold" />
        </button>
      </div>

      {menu && (
        <div role="menu" style={menu} className="fixed z-50 w-64 rounded-2xl border border-rule bg-surface p-1.5 text-sm shadow-2xl shadow-ink/15">
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-ink-3">Column</p>
          <button role="menuitem" disabled={pending} onClick={() => { setMenu(null); setRenaming(true); }} className={item}>
            <PencilSimple size={16} className="text-ink-3" /> Rename
          </button>
          <label className={`${item} cursor-pointer justify-between`}>
            <span className="flex items-center gap-2.5">
              <CheckCircle size={16} className="text-ink-3" />
              <span>
                Counts as done
                <span className="block text-[11px] text-ink-3">Tasks here are complete</span>
              </span>
            </span>
            <input type="checkbox" role="switch" className="switch scale-90" checked={c.done} disabled={pending} onChange={(e) => run(() => setColumnDoneAction(c.id, e.target.checked), false)} />
          </label>
          {!first && (
            <button role="menuitem" disabled={pending} onClick={() => run(() => moveColumnAction(c.id, -1))} className={`${item} lg:hidden`}>
              <ArrowLeft size={16} className="text-ink-3" /> Move left
            </button>
          )}
          {!last && (
            <button role="menuitem" disabled={pending} onClick={() => run(() => moveColumnAction(c.id, 1))} className={`${item} lg:hidden`}>
              <ArrowRight size={16} className="text-ink-3" /> Move right
            </button>
          )}
          {!only && (
            <>
              <div className="my-1 border-t border-rule" />
              {confirmDelete ? (
                <div className="space-y-2 rounded-xl bg-danger/5 p-2.5">
                  <p className="text-xs text-ink-2">
                    Delete “{c.name}”?{count ? ` Its ${count} task${count === 1 ? "" : "s"} move to “${firstName}”.` : ""}
                  </p>
                  <div className="flex gap-1.5">
                    <button disabled={pending} onClick={() => run(() => deleteColumnAction(c.id))} className="btn btn-danger flex-1 bg-danger/10 px-3 py-1.5 text-xs">Delete</button>
                    <button onClick={() => setConfirmDelete(false)} className="btn flex-1 px-3 py-1.5 text-xs text-ink-2 hover:bg-surface-2">Cancel</button>
                  </div>
                </div>
              ) : (
                <button role="menuitem" onClick={() => setConfirmDelete(true)} className={`${item} text-danger hover:bg-danger/10`}>
                  <Trash size={16} /> Delete column
                </button>
              )}
            </>
          )}
        </div>
      )}
      {error && <p role="alert" className="px-1 pt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

function AddColumn({ groupId }: { groupId: string }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  if (!adding)
    return (
      <button onClick={() => setAdding(true)} className="flex w-44 shrink-0 items-center justify-center gap-1.5 rounded-[24px] border border-dashed border-rule py-3 text-sm text-ink-3 transition hover:border-accent hover:text-accent-text">
        <Plus size={16} weight="bold" /> Add column
      </button>
    );
  return (
    <form
      action={(fd) =>
        start(async () => {
          const r = await addColumnAction(groupId, String(fd.get("name") ?? ""));
          setError(r.error);
          if (!r.error) setAdding(false);
        })
      }
      className="w-64 shrink-0 space-y-2 rounded-[24px] bg-surface-2 p-3"
    >
      <input name="name" autoFocus required maxLength={40} placeholder="Column name, e.g. Review" aria-label="Column name" onKeyDown={(e) => e.key === "Escape" && setAdding(false)} className="input py-2" />
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="btn btn-primary px-3 py-1.5">Add</button>
        <button type="button" onClick={() => setAdding(false)} className="btn px-3 py-1.5 text-ink-3">Cancel</button>
      </div>
    </form>
  );
}

// Repeat interval: a switch to turn it on, then a 1–30 day slider. The slider
// tracks locally while dragging and commits on release. Keyed by task id in the
// sheet, so it reinitialises when another task opens.
function RepeatControl({ task, pending, save }: { task: TaskFull; pending: boolean; save: (v: number | null) => void }) {
  const [repeat, setRepeat] = useState<number | null>(task.repeatEvery);
  const commit = (e: React.SyntheticEvent<HTMLInputElement>) => save(Number(e.currentTarget.value));
  return (
    <section className="space-y-2">
      <h3 className="label">Repeat</h3>
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={repeat !== null}
          disabled={pending}
          onChange={(e) => { const v = e.target.checked ? (repeat ?? 1) : null; setRepeat(v); save(v); }}
        />
        <span className="text-sm">{repeat !== null ? repeatLabel(repeat) : "Does not repeat"}</span>
      </label>
      {repeat !== null && (
        <>
          <input
            type="range"
            min={1}
            max={30}
            value={repeat}
            aria-label="Repeat every (days)"
            aria-valuetext={repeatLabel(repeat)}
            onChange={(e) => setRepeat(Number(e.target.value))}
            onPointerUp={commit}
            onKeyUp={commit}
            className="w-full accent-accent-strong"
          />
          <p className="text-xs text-ink-3">Finishing it schedules the next one{task.due ? "" : " from today"}.</p>
        </>
      )}
    </section>
  );
}

// Task details: title, status, due date/time and reminder, repeat, subtasks,
// labels, notes, delete. A bottom sheet on phones, a panel from the right on larger screens.
function TaskSheet({ task, today, locale, labels, columns, move, onClose }: {
  task: TaskFull | null; today: string; locale: string; labels: Label[]; columns: TaskColumn[]; move: Move; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [editLabels, setEditLabels] = useState(false);
  const [permission, setPermission] = useState<string>(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
  const noteForm = useRef<HTMLFormElement>(null);
  const subForm = useRef<HTMLFormElement>(null);
  const labelForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (task && d && !d.open) d.showModal();
    if (!task && d?.open) d.close();
  }, [task]);

  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setError(res.error);
      if (!res.error) after?.();
    });

  // Due date, time and reminder are saved together so the reminder's moment stays in step.
  const saveDue = (t: TaskFull, patch: { due?: string | null; dueTime?: string | null; remindOffset?: number | null }) => {
    const next = { due: t.due, dueTime: t.dueTime, remindOffset: t.remindOffset, ...patch };
    if (!next.due) next.remindOffset = null;
    run(() => updateTaskAction(t.id, { ...next, remindAt: remindAt(next.due, next.dueTime, next.remindOffset) }));
  };

  return (
    <dialog
      ref={dialog}
      onClose={() => { setConfirming(false); setEditLabels(false); setError(undefined); onClose(); }}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      aria-label={task?.title ?? "Task"}
      className="sheet mx-0 mb-0 mt-auto max-h-[92dvh] w-full max-w-full overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink backdrop:bg-black/40 md:my-0 md:ml-auto md:mr-0 md:h-dvh md:max-h-dvh md:w-[460px] md:rounded-l-[28px] md:rounded-tr-none md:p-6"
    >
      {task && (
        <div className="space-y-6">
          <div className="flex items-start gap-2">
            <input
              key={task.id + task.title}
              defaultValue={task.title}
              aria-label="Title"
              maxLength={300}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== task.title) run(() => updateTaskAction(task.id, { title: v }));
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="min-w-0 flex-1 rounded-xl bg-transparent px-1 py-1 text-xl font-medium outline-none focus:bg-surface-2"
            />
            <button onClick={() => dialog.current?.close()} aria-label="Close" className="-mr-2 rounded-full p-2 text-ink-3 hover:bg-surface-2"><X size={20} /></button>
          </div>

          <section className="space-y-1.5">
            <h3 className="label">Status</h3>
            <div className="seg w-full overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Status">
              {columns.map((c) => (
                <button
                  key={c.id}
                  onClick={() => move(task.id, { columnId: c.id })}
                  aria-pressed={task.columnId === c.id}
                  className={`min-w-fit flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium ${task.columnId === c.id ? "bg-accent-strong text-white" : "text-ink-3 hover:text-ink"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="label">Due</h3>
            <div className="flex flex-wrap items-center gap-2">
              <input
                key={task.id + (task.due ?? "")}
                type="date"
                aria-label="Due date"
                defaultValue={task.due ?? ""}
                onChange={(e) => saveDue(task, { due: e.target.value || null })}
                className="input w-auto"
              />
              <input
                key={task.id + (task.dueTime ?? "") + "t"}
                type="time"
                aria-label="Due time (optional)"
                disabled={!task.due}
                defaultValue={task.dueTime ?? ""}
                onChange={(e) => saveDue(task, { dueTime: e.target.value || null })}
                className="input w-auto disabled:opacity-50"
              />
              {task.due && <DueChip due={task.due} time={task.dueTime} today={today} done={task.status === "done"} />}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Bell size={16} className="text-ink-3" aria-hidden />
              <select
                key={task.id + String(task.remindOffset)}
                aria-label="Reminder"
                disabled={!task.due}
                defaultValue={task.remindOffset === null ? "" : String(task.remindOffset)}
                onChange={(e) => saveDue(task, { remindOffset: e.target.value === "" ? null : Number(e.target.value) })}
                className="input w-auto py-2 disabled:opacity-50"
              >
                {REMINDERS.map((r) => <option key={r.label} value={r.value === null ? "" : r.value}>{r.label}</option>)}
              </select>
              {!task.due && <span className="text-xs text-ink-3">Set a due date to add a reminder.</span>}
            </div>
            {task.remindOffset !== null && permission === "default" && (
              <button onClick={() => Notification.requestPermission().then(setPermission)} className="btn btn-ghost py-1.5 text-xs">
                <Bell size={14} /> Allow notifications for reminders
              </button>
            )}
            {task.remindOffset !== null && permission === "denied" && (
              <p className="text-xs text-ink-3">Notifications are blocked in this browser — reminders will show inside the app.</p>
            )}
          </section>

          <RepeatControl key={task.id} task={task} pending={pending} save={(v) => run(() => updateTaskAction(task.id, { repeatEvery: v }))} />

          <section className="space-y-2">
            <h3 className="label">Subtasks</h3>
            {task.subtasks.length > 0 && (
              <ul className="space-y-1">
                {task.subtasks.map((s) => {
                  const isDone = s.status === "done";
                  return (
                    <li key={s.id} className="group flex items-center gap-2.5 rounded-xl px-1 py-1 hover:bg-surface-2">
                      <button
                        role="checkbox"
                        aria-checked={isDone}
                        aria-label={`${s.title}: mark ${isDone ? "not done" : "done"}`}
                        disabled={pending}
                        onClick={() => run(() => updateTaskAction(s.id, { status: isDone ? "todo" : "done" }))}
                        className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 ${isDone ? "border-accent-strong bg-accent-strong text-white" : "border-rule"}`}
                      >
                        {isDone && <Check size={11} weight="bold" />}
                      </button>
                      <span className={`min-w-0 flex-1 text-sm ${isDone ? "text-ink-3 line-through" : ""}`}>{s.title}</span>
                      <button onClick={() => run(() => deleteTaskAction(s.id))} aria-label={`Delete ${s.title}`} className="rounded-full p-1 text-ink-3 hover:text-danger sm:opacity-0 sm:focus:opacity-100 sm:group-hover:opacity-100">
                        <X size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <form
              ref={subForm}
              action={(fd) => run(() => addSubtaskAction(task.id, task.groupId, String(fd.get("title") ?? "")), () => subForm.current?.reset())}
              className="flex gap-2"
            >
              <input name="title" required maxLength={300} placeholder="Add a subtask…" aria-label="New subtask" className="input py-2" />
              <button disabled={pending} aria-label="Add subtask" className="btn btn-ghost shrink-0 px-3"><Plus size={16} weight="bold" /></button>
            </form>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="label mb-0">Labels</h3>
              {labels.length > 0 && (
                <button onClick={() => setEditLabels(!editLabels)} className="text-xs text-ink-3 hover:text-ink">{editLabels ? "Done" : "Edit labels"}</button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 empty:hidden">
              {labels.map((l) => {
                const on = task.labels.some((x) => x.id === l.id);
                return editLabels ? (
                  <button
                    key={l.id}
                    disabled={pending}
                    onClick={() => run(() => deleteLabelAction(l.id))}
                    aria-label={`Delete label ${l.name}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-danger/40 px-3 py-1 text-xs text-danger"
                  >
                    {l.name} <X size={12} />
                  </button>
                ) : (
                  <button
                    key={l.id}
                    disabled={pending}
                    onClick={() => run(() => setTaskLabelAction(task.id, l.id, !on))}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${on ? "border-transparent font-medium text-ink" : "border-rule text-ink-2 hover:border-accent/40"}`}
                    style={on ? { background: `color-mix(in oklab, ${l.color} 22%, transparent)` } : undefined}
                  >
                    <span className="size-2 rounded-full" style={{ background: l.color }} aria-hidden /> {l.name}
                  </button>
                );
              })}
            </div>
            <form
              ref={labelForm}
              action={(fd) =>
                run(async () => {
                  const res = await createLabelAction(String(fd.get("name") ?? ""), GROUP_COLORS[labels.length % GROUP_COLORS.length]);
                  return res.id ? setTaskLabelAction(task.id, res.id, true) : res;
                }, () => labelForm.current?.reset())
              }
              className="flex gap-2"
            >
              <input name="name" required maxLength={30} placeholder="New label, e.g. Urgent" aria-label="New label" className="input py-2" />
              <button disabled={pending} aria-label="Add label" className="btn btn-ghost shrink-0 px-3"><Plus size={16} weight="bold" /></button>
            </form>
          </section>

          <section className="space-y-2">
            <h3 className="label">Notes</h3>
            {task.notes.length > 0 && (
              <ul className="space-y-2">
                {task.notes.map((n) => (
                  <li key={n.id} className="flex gap-2 rounded-2xl bg-surface-2 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words text-sm">{n.body}</p>
                      <p className="mt-1 text-[11px] text-ink-3">{new Date(n.createdAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</p>
                    </div>
                    <button disabled={pending} onClick={() => run(() => deleteNoteAction(n.id))} aria-label="Delete note" className="self-start rounded-full p-1.5 text-ink-3 hover:bg-danger/10 hover:text-danger">
                      <Trash size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              ref={noteForm}
              action={(fd) => run(() => addNoteAction(task.id, String(fd.get("body") ?? "")), () => noteForm.current?.reset())}
              className="space-y-2"
            >
              <textarea name="body" required maxLength={2000} rows={2} placeholder="Add a short note…" aria-label="New note" className="input resize-none" />
              <button disabled={pending} className="btn btn-ghost">Add note</button>
            </form>
          </section>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          <div className="border-t border-rule pt-4">
            {confirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-ink-2">Delete this task, its subtasks and notes?</span>
                <button disabled={pending} onClick={() => run(() => deleteTaskAction(task.id), () => dialog.current?.close())} className="btn btn-danger px-3 py-1.5">Delete</button>
                <button onClick={() => setConfirming(false)} className="btn btn-ghost px-3 py-1.5">Keep</button>
              </div>
            ) : (
              <button onClick={() => setConfirming(true)} className="btn btn-danger -ml-3"><Trash size={16} /> Delete task</button>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
