"use client";

import { Check } from "@phosphor-icons/react/ssr";
import { haptic } from "@/lib/haptics";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { updateTaskAction } from "@/lib/actions/tasks";
import { toggleCheckAction } from "@/lib/actions/trackers";
import { DueChip } from "./TaskView";

// The overview's tickable rows: a task due soon, and a habit for today.

// Overview rows keep titles short: cap the length, then an ellipsis. Phones
// allow 30 characters, desktop (lg+) 70 — rendered as two spans, CSS picks one.
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

function Tick({ on, color, label, onToggle }: { on: boolean; color: string; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={() => { haptic(); onToggle(); }}
      aria-pressed={on}
      aria-label={label}
      className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition ${on ? "border-transparent text-white" : "hover:bg-surface-2"}`}
      style={on ? { background: color } : { borderColor: color }}
    >
      {on && <Check size={13} weight="bold" />}
    </button>
  );
}

export function TaskRow({ t, group, today }: {
  t: { id: string; title: string; due: string | null; dueTime: string | null };
  group: { id: string; name: string; color: string };
  today: string;
}) {
  const [done, setDone] = useOptimistic(false);
  const [, start] = useTransition();
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Tick on={done} color={group.color} label={`Mark "${t.title}" done`} onToggle={() => start(async () => { setDone(true); await updateTaskAction(t.id, { status: "done" }); })} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${done ? "text-ink-3 line-through" : ""}`}>
          <span className="lg:hidden">{clip(t.title, 30)}</span>
          <span className="hidden lg:inline">{clip(t.title, 70)}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
          <DueChip due={t.due} time={t.dueTime} today={today} done={done} />
          <Link href={`/tasks/${group.id}`} className="inline-flex items-center gap-1 text-ink-3 hover:text-accent-text">
            <span className="size-2 rounded-full" style={{ background: group.color }} aria-hidden /> {group.name}
          </Link>
        </p>
      </div>
    </li>
  );
}

export function HabitRow({ h, today }: { h: { id: string; name: string; color: string; doneToday: boolean; streak: number | null }; today: string }) {
  const [done, setDone] = useOptimistic(h.doneToday);
  const [, start] = useTransition();
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Tick on={done} color={h.color} label={`${h.name} done today`} onToggle={() => start(async () => { setDone(!done); await toggleCheckAction(h.id, today); })} />
      <Link href={`/trackers/${h.id}`} className={`min-w-0 flex-1 truncate text-sm font-medium hover:text-accent-text ${done ? "text-ink-3" : ""}`}>{h.name}</Link>
      {!!h.streak && <span className="text-xs tabular-nums text-ink-3">🔥 {h.streak}</span>}
    </li>
  );
}
