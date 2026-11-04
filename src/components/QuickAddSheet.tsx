"use client";

import { Plus, X } from "@phosphor-icons/react/ssr";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { TrackerMode } from "@/db/schema";
import type { FormState } from "@/lib/actions/auth";
import { createNoteAction } from "@/lib/actions/notes";
import { createTaskAction } from "@/lib/actions/tasks";
import { addEntryAction, setRatingAction, toggleCheckAction } from "@/lib/actions/trackers";
import { haptic } from "@/lib/haptics";
import { moodFace } from "@/lib/format";
import { AppIcon, type IconName } from "./AppIcon";
import { ADD_CARD, AddBadge } from "./CollectionDialog";
import { TransactionForm } from "./TransactionForm";

// "Quick add" from the Overview: a task, a note, an expense or a tracker log
// without leaving the page. `trigger`: the dashed card at the bottom of the
// Overview panel (desktop), or a floating + on the Overview page (phones).

type Tracker = { id: string; name: string; mode: TrackerMode; unit: string; quickAdd: number | null };
type Props = {
  trigger: "card" | "fab";
  groups: { id: string; name: string }[];
  expenseCategories: { id: string; name: string }[];
  trackers: Tracker[];
  currency: string;
  today: string;
};

const TABS: { key: "task" | "note" | "expense" | "log"; label: string; icon: IconName }[] = [
  { key: "task", label: "Task", icon: "tasks" },
  { key: "note", label: "Note", icon: "notes" },
  { key: "expense", label: "Expense", icon: "expense" },
  { key: "log", label: "Log", icon: "trackers" },
];

export function QuickAddSheet(p: Props) {
  const path = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("task");
  const close = () => sheet.current?.close();
  const open = () => {
    sheet.current?.showModal();
    requestAnimationFrame(() => sheet.current?.querySelector<HTMLInputElement>("input:not([type=hidden]), textarea")?.focus());
  };
  if (p.trigger === "fab" && path !== "/") return null;

  return (
    <>
      {p.trigger === "card" ? (
        <button type="button" onClick={open} className={ADD_CARD}>Quick add<AddBadge /></button>
      ) : (
        <button
          type="button"
          onClick={open}
          aria-label="Quick add"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex size-14 items-center justify-center rounded-full border border-black/20 bg-accent-strong text-white shadow-xl shadow-accent-strong/40 active:scale-95 sm:right-[calc(50%-14rem)] lg:hidden"
        >
          <Plus size={26} weight="bold" />
        </button>
      )}
      <dialog
        ref={sheet}
        aria-label="Quick add"
        onClick={(e) => e.target === sheet.current && close()}
        className="sheet mx-0 mb-0 mt-auto max-h-[92dvh] w-full max-w-full overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-[28px] sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quick add</h2>
          <button type="button" onClick={close} aria-label="Close" className="-mr-2 rounded-full p-2 text-ink-3 hover:bg-surface-2"><X size={20} /></button>
        </div>
        <div role="tablist" aria-label="What to add" className="mb-5 grid grid-cols-4 gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center gap-1 rounded-2xl border py-2 text-xs transition ${tab === t.key ? "border-accent bg-accent-soft font-medium" : "border-rule hover:border-accent/40"}`}
            >
              <AppIcon.Glyph name={t.icon} size={20} weight={tab === t.key ? "fill" : "regular"} />
              {t.label}
            </button>
          ))}
        </div>
        {tab === "task" && <TaskTab groups={p.groups} onDone={close} />}
        {tab === "note" && <NoteTab onDone={close} />}
        {tab === "expense" && (
          <TransactionForm kind="expense" categories={p.expenseCategories} currency={p.currency} today={p.today} onDone={close} />
        )}
        {tab === "log" && <LogTab trackers={p.trackers} today={p.today} onDone={close} />}
      </dialog>
    </>
  );
}

const Err = ({ state }: { state: FormState }) => (state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null);

function useClosingAction(action: (prev: FormState, fd: FormData) => Promise<FormState>, onDone: () => void) {
  const form = useRef<HTMLFormElement>(null);
  const [state, run, pending] = useActionState(action, {});
  useEffect(() => {
    if (state.ok) {
      haptic();
      form.current?.reset();
      onDone();
    }
  }, [state, onDone]);
  return { form, state, run, pending };
}

function TaskTab({ groups, onDone }: { groups: Props["groups"]; onDone: () => void }) {
  const { form, state, run, pending } = useClosingAction(createTaskAction, onDone);
  if (!groups.length) return <p className="py-6 text-center text-sm text-ink-3">Create a task group first (Tasks › Add group).</p>;
  return (
    <form ref={form} action={run} className="space-y-3">
      <input name="title" required maxLength={300} placeholder="What needs doing?" aria-label="Task" className="input" />
      <div className="grid grid-cols-2 gap-3">
        <select name="groupId" required aria-label="Group" className="input">
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input name="due" type="date" aria-label="Due date (optional)" className="input" />
      </div>
      <Err state={state} />
      <button disabled={pending} className="btn btn-primary">{pending ? "Adding…" : "Add task"}</button>
    </form>
  );
}

function NoteTab({ onDone }: { onDone: () => void }) {
  const { form, state, run, pending } = useClosingAction(
    (_, fd) => createNoteAction({ title: String(fd.get("title") ?? ""), body: String(fd.get("body") ?? "") }),
    onDone,
  );
  return (
    <form ref={form} action={run} className="space-y-3">
      <input name="title" maxLength={200} placeholder="Title" aria-label="Title" className="input" />
      <textarea name="body" rows={4} maxLength={20_000} placeholder="Take a note…" aria-label="Note" className="input resize-none" />
      <Err state={state} />
      <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save note"}</button>
    </form>
  );
}

function LogTab({ trackers, today, onDone }: { trackers: Tracker[]; today: string; onDone: () => void }) {
  const usable = trackers.filter((t) => t.mode !== "since");
  const [id, setId] = useState(usable[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  const t = usable.find((x) => x.id === id);
  const finish = (res: FormState) => {
    setState(res);
    if (res.ok) { haptic(); setValue(""); onDone(); }
  };
  if (!t) return <p className="py-6 text-center text-sm text-ink-3">No trackers yet — add one from Trackers.</p>;
  return (
    <div className="space-y-3">
      <select value={id} onChange={(e) => { setId(e.target.value); setState({}); }} aria-label="Tracker" className="input">
        {usable.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      {t.mode === "check" ? (
        <button disabled={pending} onClick={() => start(async () => finish(await toggleCheckAction(t.id, today)))} className="btn btn-primary">
          Mark done today
        </button>
      ) : t.mode === "rating" ? (
        <div className="flex justify-between gap-1" role="radiogroup" aria-label="How was today?">
          {[1, 2, 3, 4, 5].map((v) => (
            <button key={v} role="radio" aria-checked={false} aria-label={`${v} of 5`} disabled={pending}
              onClick={() => start(async () => finish(await setRatingAction(t.id, today, v)))}
              className="flex flex-1 justify-center rounded-xl py-2 text-2xl transition hover:bg-surface-2">
              {moodFace(v)}
            </button>
          ))}
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); start(async () => finish(await addEntryAction(t.id, value, today))); }}
          className="flex gap-2"
        >
          <input
            value={value} onChange={(e) => setValue(e.target.value)} required inputMode="decimal" type="number" step="any"
            placeholder={t.unit ? `Amount (${t.unit})` : "Value"} aria-label="Value" className="input min-w-0 flex-1"
          />
          {t.quickAdd != null && (
            <button type="button" disabled={pending} onClick={() => start(async () => finish(await addEntryAction(t.id, String(t.quickAdd), today)))} className="btn btn-ghost shrink-0">
              +{t.quickAdd}{t.unit ? ` ${t.unit}` : ""}
            </button>
          )}
          <button disabled={pending} className="btn btn-primary shrink-0">Log</button>
        </form>
      )}
      {t.mode === "check" && <p className="text-xs text-ink-3">Already done today? This undoes it.</p>}
      <Err state={state} />
    </div>
  );
}
