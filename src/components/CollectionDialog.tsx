"use client";

import { Kanban, ListChecks, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { ListView } from "@/db/schema";
import type { FormState } from "@/lib/actions/auth";
import { GROUP_COLORS, GROUP_ICONS, type GroupIcon } from "@/lib/group-icons";
import { AppIcon } from "./AppIcon";

export type Trigger = "plus" | "button" | "edit" | "card";

// The dashed "Add …" card at the bottom of a side-panel list.
export const ADD_CARD = "flex w-full items-center justify-between gap-2 rounded-[20px] border border-dashed border-accent/40 py-2.5 pl-4 pr-2 text-left text-[15px] font-medium text-accent-text transition hover:border-accent hover:bg-surface/60";
export const AddBadge = () => <span className="flex size-8 items-center justify-center rounded-full bg-accent-strong text-white shadow-md shadow-accent-strong/30"><Plus size={16} weight="bold" /></span>;

// Same card, opening a page instead of a dialog (e.g. Add tracker).
export function AddCardLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className={ADD_CARD}>{label}<AddBadge /></Link>;
}
type Item = { id: string; name: string; color: string; icon: GroupIcon; view?: ListView };

// Create (no `item`) or edit a named thing with an icon and colour — a task
// group (`withView`: also list/board) or a note category. `trigger` picks the
// button: a card or round + (side panel), a labelled button, or a pencil.
export function CollectionDialog({ item, trigger, noun, save, remove, withView = false }: {
  item?: Item;
  trigger: Trigger;
  noun: string;
  save: (prev: FormState, fd: FormData) => Promise<FormState>;
  remove: (id: string) => Promise<unknown>;
  withView?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(save, {});
  const [icon, setIcon] = useState<GroupIcon>(item?.icon ?? (withView ? "checklist" : "star"));
  const [color, setColor] = useState(item?.color ?? GROUP_COLORS[0]);
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();
  useEffect(() => { if (state.ok) dialog.current?.close(); }, [state]);

  const open = () => dialog.current?.showModal();
  return (
    <>
      {trigger === "card" ? (
        <button onClick={open} className={ADD_CARD}>
          Add {noun}
          <AddBadge />
        </button>
      ) : trigger === "plus" ? (
        <button onClick={open} aria-label={`New ${noun}`} title={`New ${noun}`} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-strong text-white shadow-md shadow-accent-strong/30 transition hover:brightness-110">
          <Plus size={18} weight="bold" />
        </button>
      ) : trigger === "edit" ? (
        <button onClick={open} aria-label={`Edit ${noun}`} title={`Edit ${noun}`} className="rounded-full p-2 text-ink-3 hover:bg-surface-2 hover:text-ink"><PencilSimple size={18} /></button>
      ) : (
        <button onClick={open} className="btn btn-primary"><Plus size={16} weight="bold" /> New {noun}</button>
      )}
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        onClose={() => setConfirming(false)}
        aria-label={item ? `Edit ${noun}` : `New ${noun}`}
        className="sheet mx-0 mb-0 mt-auto max-h-[92dvh] w-full max-w-full overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink backdrop:bg-black/40 sm:m-auto sm:max-w-md sm:rounded-[28px] sm:p-6"
      >
        <form action={action} className="space-y-5">
          {item && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="icon" value={icon} />
          <input type="hidden" name="color" value={color} />
          <div className="flex items-center gap-3">
            <AppIcon name={icon} size={44} color={color} />
            <h2 className="flex-1 text-lg font-medium">{item ? `Edit ${noun}` : `New ${noun}`}</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="-mr-2 rounded-full p-2 text-ink-3 hover:bg-surface-2"><X size={20} /></button>
          </div>

          <div>
            <label className="label" htmlFor={`cname-${item?.id ?? noun}`}>Name</label>
            <input id={`cname-${item?.id ?? noun}`} name="name" required maxLength={60} defaultValue={item?.name} placeholder={withView ? "e.g. Business, Health, Home" : "e.g. Ideas, Recipes, Journal"} className="input" />
          </div>

          <AppearanceFields icon={icon} setIcon={setIcon} color={color} setColor={setColor} />

          {withView && (
            <fieldset>
              <legend className="label">Show tasks as</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["list", "board"] as const).map((v) => (
                  <label key={v} className="cursor-pointer">
                    <input type="radio" name="view" value={v} defaultChecked={(item?.view ?? "list") === v} className="peer sr-only" />
                    <span className="flex items-center gap-2 rounded-2xl border border-rule p-3 text-sm peer-checked:border-accent peer-checked:bg-accent-soft peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                      {v === "list" ? <ListChecks size={20} /> : <Kanban size={20} />}
                      <span>
                        <span className="block font-medium">{v === "list" ? "List" : "Board"}</span>
                        <span className="block text-xs text-ink-3">{v === "list" ? "A simple checklist" : "To do · Doing · Done"}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : item ? "Save" : `Create ${noun}`}</button>
            {item &&
              (confirming ? (
                <span className="ml-auto flex items-center gap-1">
                  <button type="button" disabled={deleting} onClick={() => startDelete(async () => { await remove(item.id); })} className="btn btn-danger px-3 py-1.5">
                    {withView ? "Delete with all tasks" : "Delete (notes are kept)"}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost px-3 py-1.5">Keep</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} className="btn btn-danger ml-auto"><Trash size={16} /> Delete {noun}</button>
              ))}
          </div>
        </form>
      </dialog>
    </>
  );
}

// Icon grid and colour swatches; the chosen values live in the parent (which
// submits them as hidden inputs).
export function AppearanceFields({ icon, setIcon, color, setColor }: { icon: GroupIcon; setIcon: (i: GroupIcon) => void; color: string; setColor: (c: string) => void }) {
  return (
    <>
      <fieldset>
        <legend className="label">Icon</legend>
        <div className="grid grid-cols-8 gap-1.5">
          {GROUP_ICONS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setIcon(k)}
              aria-label={k}
              aria-pressed={icon === k}
              className={`flex aspect-square items-center justify-center rounded-xl transition ${icon === k ? "ring-2 ring-offset-2 ring-offset-surface" : "hover:bg-surface-2"}`}
              style={icon === k ? ({ "--tw-ring-color": color } as React.CSSProperties) : undefined}
            >
              <AppIcon name={k} size={32} color={icon === k ? color : undefined} />
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {GROUP_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              aria-pressed={color === c}
              className={`size-8 rounded-full ring-offset-2 ring-offset-surface ${color === c ? "ring-2 ring-ink" : ""}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </fieldset>
    </>
  );
}
