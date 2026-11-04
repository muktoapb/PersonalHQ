"use client";

import { Archive, ArrowCounterClockwise, CheckSquare, Palette, PushPin, Trash, X } from "@phosphor-icons/react/ssr";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { type NoteColor, NOTE_COLORS, type NoteItem } from "@/db/schema";
import { createNoteAction, deleteCategoryAction, deleteNoteAction, placeNoteAction, saveCategoryAction, updateNoteAction } from "@/lib/actions/notes";
import type { NoteRow } from "@/lib/core/notes";
import type { GroupIcon } from "@/lib/group-icons";
import { CollectionDialog, type Trigger } from "./CollectionDialog";

// Google Keep-style notes: a composer that expands from "Take a note…", a
// masonry grid of coloured cards (pinned first), and an editor that saves when
// it closes.

export function CategoryDialog(p: { category?: { id: string; name: string; color: string; icon: GroupIcon }; trigger: Trigger }) {
  return <CollectionDialog trigger={p.trigger} item={p.category} noun="category" save={saveCategoryAction} remove={deleteCategoryAction} />;
}

const bg = (c: NoteColor) => (c === "default" ? undefined : `var(--note-${c})`);
type Draft = { title: string; body: string; items: NoteItem[] | null; color: NoteColor; pinned: boolean };
const EMPTY: Draft = { title: "", body: "", items: null, color: "default", pinned: false };
const hasContent = (d: Draft) => d.title.trim() || d.body.trim() || d.items?.some((i) => i.text.trim());

function ColorPicker({ value, onChange }: { value: NoteColor; onChange: (c: NoteColor) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-label="Colour" aria-expanded={open} className="rounded-full p-2 text-ink-2 hover:bg-ink/5">
        <Palette size={18} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 flex w-max max-w-[16rem] flex-wrap gap-1.5 rounded-2xl border border-rule bg-surface p-2 shadow-xl">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              aria-label={c}
              aria-pressed={value === c}
              className={`size-7 rounded-full border ${value === c ? "border-accent ring-2 ring-accent" : "border-rule"}`}
              style={{ background: bg(c) ?? "var(--surface)" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Checklist editing: Enter adds an item below, Backspace on an empty item removes it.
function ChecklistEditor({ items, onChange }: { items: NoteItem[]; onChange: (items: NoteItem[]) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  useEffect(() => {
    if (focus !== null) refs.current[focus]?.focus();
  }, [focus, items.length]);
  const set = (i: number, patch: Partial<NoteItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <ul className="space-y-1">
      {items.map((it, i) => (
        <li key={i} className="group flex items-center gap-2">
          <input type="checkbox" checked={it.done} onChange={(e) => set(i, { done: e.target.checked })} aria-label={`Done: ${it.text || "item"}`} className="size-4 shrink-0 accent-[var(--accent-strong)]" />
          <input
            ref={(el) => { refs.current[i] = el; }}
            value={it.text}
            onChange={(e) => set(i, { text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onChange([...items.slice(0, i + 1), { text: "", done: false }, ...items.slice(i + 1)]);
                setFocus(i + 1);
              } else if (e.key === "Backspace" && !it.text && items.length > 1) {
                e.preventDefault();
                onChange(items.filter((_, j) => j !== i));
                setFocus(Math.max(0, i - 1));
              }
            }}
            placeholder="List item"
            maxLength={500}
            className={`min-w-0 flex-1 bg-transparent py-1 text-sm outline-none ${it.done ? "text-ink-3 line-through" : ""}`}
          />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove item" className="rounded-full p-1 text-ink-3 hover:text-ink sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <X size={14} />
          </button>
        </li>
      ))}
      <li>
        <button type="button" onClick={() => { onChange([...items, { text: "", done: false }]); setFocus(items.length); }} className="py-1 pl-6 text-sm text-ink-3 hover:text-ink">
          + List item
        </button>
      </li>
    </ul>
  );
}

// Title + text or checklist, shared by the composer and the editor.
function DraftFields({ d, set, autoFocus }: { d: Draft; set: (patch: Partial<Draft>) => void; autoFocus?: boolean }) {
  return (
    <>
      <input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Title" aria-label="Title" maxLength={200} className="w-full bg-transparent text-base font-medium outline-none placeholder:text-ink-3" />
      {d.items ? (
        <ChecklistEditor items={d.items} onChange={(items) => set({ items })} />
      ) : (
        <textarea
          value={d.body}
          onChange={(e) => set({ body: e.target.value })}
          placeholder="Take a note…"
          aria-label="Note"
          autoFocus={autoFocus}
          rows={3}
          maxLength={20_000}
          className="field-sizing-content min-h-16 w-full resize-none bg-transparent text-sm outline-none placeholder:text-ink-3"
        />
      )}
    </>
  );
}

// Toggling turns text lines into checklist items and back.
const toggleChecklist = (d: Draft): Partial<Draft> =>
  d.items
    ? { items: null, body: d.items.map((i) => i.text).join("\n") }
    : { items: d.body.split("\n").map((t) => ({ text: t, done: false })).filter((i, n, a) => i.text.trim() || a.length === 1), body: "" };

export function NoteComposer({ categoryId }: { categoryId: string | null }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));

  // Like Keep: closing (button or a click outside) saves a non-empty note.
  const close = () => {
    if (!hasContent(d)) {
      setOpen(false);
      setD(EMPTY);
      return;
    }
    start(async () => {
      const res = await createNoteAction({ ...d, categoryId });
      if (res.error) return setError(res.error);
      setError(undefined);
      setOpen(false);
      setD(EMPTY);
    });
  };
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node) && !(e.target as Element).closest("dialog")) closeRef.current();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div ref={box} className="mx-auto w-full max-w-xl rounded-2xl border border-rule shadow-md shadow-ink/5 transition" style={{ background: bg(d.color) ?? "var(--surface)" }}>
      {!open ? (
        <div className="flex items-center gap-1 p-1.5 pl-4">
          <button onClick={() => setOpen(true)} className="flex-1 py-2 text-left text-sm text-ink-3">Take a note…</button>
          <button onClick={() => { setOpen(true); set({ items: [{ text: "", done: false }] }); }} aria-label="New checklist" title="New checklist" className="rounded-full p-2.5 text-ink-2 hover:bg-surface-2">
            <CheckSquare size={20} />
          </button>
        </div>
      ) : (
        <div className="space-y-2 p-4 pb-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 space-y-2"><DraftFields d={d} set={set} autoFocus /></div>
            <button type="button" onClick={() => set({ pinned: !d.pinned })} aria-pressed={d.pinned} aria-label={d.pinned ? "Unpin" : "Pin"} className="rounded-full p-2 text-ink-2 hover:bg-ink/5">
              <PushPin size={18} weight={d.pinned ? "fill" : "regular"} />
            </button>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex items-center gap-1">
            <ColorPicker value={d.color} onChange={(color) => set({ color })} />
            <button type="button" onClick={() => set(toggleChecklist(d))} aria-label={d.items ? "Show as text" : "Show as checklist"} title={d.items ? "Show as text" : "Show as checklist"} className="rounded-full p-2 text-ink-2 hover:bg-ink/5">
              <CheckSquare size={18} weight={d.items ? "fill" : "regular"} />
            </button>
            <button onClick={close} disabled={pending} className="btn ml-auto px-3 py-1.5 text-ink-2 hover:bg-ink/5">{pending ? "Saving…" : "Close"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Pinned notes, then the rest, as a masonry grid. Cards open in the editor
// and can be dragged to a new place (see useNoteDrag).
export function NoteGrid({ notes, categories, showCategory }: {
  notes: NoteRow[];
  categories: { id: string; name: string }[];
  showCategory: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [items, place] = useOptimistic(notes, (cur, m: { id: string; position: number; pinned: boolean }) =>
    cur
      .map((n) => (n.id === m.id ? { ...n, position: m.position, pinned: m.pinned } : n))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.position - b.position),
  );
  const [, start] = useTransition();
  const drag = useNoteDrag(items, (id, position, pinned) =>
    start(async () => {
      place({ id, position, pinned });
      await placeNoteAction(id, position, pinned);
    }),
  );
  const st = drag.state;
  const dragged = st ? items.find((n) => n.id === st.id) : undefined;
  const lists = sectionLists(items, st?.id);

  // While dragging, the dragged note leaves the grid and a dashed gap marks
  // where it will land, so the other notes make room as you move.
  const grid = (section: Section) => {
    const list = lists[section];
    const cards = list.map((n, idx) => (
      <NoteCard key={n.id} n={n} showCategory={showCategory} open={() => setOpenId(n.id)} dragProps={{ ...drag.cardProps(n.id), "data-idx": idx }} />
    ));
    if (st?.section === section) {
      cards.splice(
        st.index,
        0,
        <div key="gap" data-placeholder className="mb-3 break-inside-avoid rounded-2xl border-2 border-dashed border-accent/60 bg-accent/5" style={{ height: st.height }} />,
      );
    }
    return (
      <div data-section={section} className={`columns-2 gap-3 lg:columns-3 xl:columns-4 ${st ? "min-h-24 rounded-2xl" : ""}`}>
        {cards}

      </div>
    );
  };
  // Sections keep their layout during a drag (nothing appears or disappears
  // under the pointer): Pinned shows when it has notes, or holds the dragged one.
  const hadPinned = items.some((n) => sectionOf(n) === "pinned");
  const showPinned = hadPinned;
  const showOthers = lists.others.length > 0 || st?.section === "others" || (!!st && dragged && sectionOf(dragged) === "others");
  return (
    <>
      {showPinned && (
        <section className="space-y-2">
          <h2 className="sticky-heading px-1 text-xs font-medium uppercase tracking-wider text-ink-3">Pinned</h2>
          {grid("pinned")}
        </section>
      )}
      {showOthers && (
        <section className="space-y-2">
          {showPinned && <h2 className="sticky-heading px-1 text-xs font-medium uppercase tracking-wider text-ink-3">Others</h2>}
          {grid("others")}
        </section>
      )}
      {st && dragged && (
        // The note you're carrying, following the pointer.
        <div
          aria-hidden
          className="pointer-events-none fixed z-50"
          style={{ left: st.x - st.offX, top: st.y - st.offY, width: st.width, transform: "rotate(2deg) scale(1.03)" }}
        >
          <NoteCard n={dragged} showCategory={showCategory} ghost />
        </div>
      )}
      <NoteEditor note={items.find((n) => n.id === openId) ?? null} categories={categories} onClose={() => setOpenId(null)} />
    </>
  );
}

type Section = "pinned" | "others";
const sectionOf = (n: NoteRow): Section => (n.pinned && !n.archived ? "pinned" : "others");
// Notes per section, leaving out the one being dragged.
const sectionLists = (items: NoteRow[], skip?: string) => ({
  pinned: items.filter((n) => n.id !== skip && sectionOf(n) === "pinned"),
  others: items.filter((n) => n.id !== skip && sectionOf(n) === "others"),
});

// Where the dragged note would land: a section and an index in it (counting
// without the dragged note), plus what's needed to draw it under the pointer.
type DragState = { id: string; section: Section; index: number; x: number; y: number; offX: number; offY: number; width: number; height: number };

// Drag to reorder, with a mouse (start by moving a few pixels) or a finger
// (press and hold briefly, then move). Hover a note to land before it (upper
// half) or after it (lower half); hover empty space in a section to land at
// its end; dropping in the other section pins or unpins. The page scrolls
// near its top/bottom edge. The new position is the midpoint of the new
// neighbours, so only the moved note is saved.
function useNoteDrag(items: NoteRow[], onDrop: (id: string, position: number, pinned: boolean) => void) {
  const [state, setState] = useState<DragState | null>(null);
  const live = useRef<{ id: string; el: HTMLElement; x0: number; y0: number; started: boolean; from?: { section: Section; index: number }; touch: boolean; timer?: number; scroller?: HTMLElement | null; vy: number; frame?: number } | null>(null);
  const stateRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const startRef = useRef<((e: React.PointerEvent<HTMLElement>, id: string) => void) | null>(null);
  const itemsRef = useRef(items);
  const dropRef = useRef(onDrop);
  useEffect(() => { itemsRef.current = items; dropRef.current = onDrop; });

  const update = (next: DragState | null) => { stateRef.current = next; setState(next); };

  useEffect(() => {
    const blockScroll = (e: TouchEvent) => { if (live.current?.started) e.preventDefault(); };
    const autoScroll = () => {
      const l = live.current;
      if (!l?.started) return;
      if (l.vy) (l.scroller ?? document.scrollingElement)?.scrollBy(0, l.vy);
      l.frame = requestAnimationFrame(autoScroll);
    };
    const begin = (x: number, y: number) => {
      const l = live.current!;
      const note = itemsRef.current.find((n) => n.id === l.id);
      if (!note) return cancel();
      const r = l.el.getBoundingClientRect();
      const section = sectionOf(note);
      // Its own slot: how many notes come before it in its section.
      const index = sectionLists(itemsRef.current)[section].findIndex((n) => n.id === note.id);
      l.from = { section, index };
      l.started = true;
      l.frame = requestAnimationFrame(autoScroll);
      document.body.style.cursor = "grabbing";
      document.documentElement.dataset.dragging = "1"; // tells pull-to-refresh to stand down
      navigator.vibrate?.(8);
      update({
        id: l.id,
        section,
        index,
        x, y, offX: l.x0 - r.left, offY: l.y0 - r.top, width: r.width, height: r.height,
      });
    };
    const onMove = (e: PointerEvent) => {
      const l = live.current;
      if (!l) return;
      if (!l.started) {
        if (Math.hypot(e.clientX - l.x0, e.clientY - l.y0) < (l.touch ? 10 : 4)) return;
        if (l.touch) return cancel(); // moved before the hold finished: it's a scroll
        begin(e.clientX, e.clientY);
      }
      const st = stateRef.current;
      if (!st) return;
      const edge = 80;
      l.vy = e.clientY < edge ? -16 : e.clientY > window.innerHeight - edge ? 16 : 0;

      let { section, index } = st;
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const card = under?.closest<HTMLElement>("[data-note]");
      if (under?.closest("[data-placeholder]")) {
        // over the gap itself: stay put (prevents flicker as cards shift)
      } else if (card) {
        const r = card.getBoundingClientRect();
        section = card.closest<HTMLElement>("[data-section]")!.dataset.section as Section;
        index = Number(card.dataset.idx) + (e.clientY > r.top + r.height / 2 ? 1 : 0);
      } else {
        const zone = under?.closest<HTMLElement>("[data-section]")?.dataset.section as Section | undefined;
        if (zone && zone !== section) {
          section = zone;
          index = sectionLists(itemsRef.current, st.id)[zone].length;
        }
      }
      const archived = itemsRef.current.find((n) => n.id === st.id)?.archived;
      if (archived) section = "others";
      update({ ...st, section, index, x: e.clientX, y: e.clientY });
    };
    const finish = () => {
      const l = live.current, st = stateRef.current;
      if (l?.started && st) {
        // Swallow the click that ends this drag (if any), but only that one.
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 0);
        const moving = itemsRef.current.find((n) => n.id === st.id);
        if (moving) {
          const list = sectionLists(itemsRef.current, st.id)[st.section];
          const prev = list[st.index - 1], next = list[st.index];
          const position = prev && next ? (prev.position + next.position) / 2 : prev ? prev.position + 1 : next ? next.position - 1 : 0;
          const pinned = st.section === "pinned";
          if (st.section !== l.from?.section || st.index !== l.from.index) dropRef.current(st.id, position, pinned);
        }
      }
      cancel();
    };
    const cancel = () => {
      const l = live.current;
      if (l?.timer) clearTimeout(l.timer);
      if (l?.frame) cancelAnimationFrame(l.frame);
      live.current = null;
      document.body.style.cursor = "";
      delete document.documentElement.dataset.dragging;
      if (stateRef.current) update(null);
    };
    startRef.current = (e: React.PointerEvent<HTMLElement>, id: string) => {
      if (e.button !== 0 || (e.target as Element).closest("[data-no-drag]")) return;
      const touch = e.pointerType !== "mouse";
      const el = e.currentTarget;
      const main = el.closest("main");
      const scroller = main && main.scrollHeight > main.clientHeight && getComputedStyle(main).overflowY !== "visible" ? main : null;
      live.current = { id, el, x0: e.clientX, y0: e.clientY, started: false, touch, scroller, vy: 0 };
      if (touch) live.current.timer = window.setTimeout(() => live.current && !live.current.started && begin(e.clientX, e.clientY), 250);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    document.addEventListener("touchmove", blockScroll, { passive: false });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      document.removeEventListener("touchmove", blockScroll);
    };
  }, []);

  return {
    state,
    cardProps: (id: string) => ({
      "data-note": id,
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => startRef.current?.(e, id),
      // A drag ends with a click on the card; don't open the note for it.
      onClickCapture: (e: React.MouseEvent) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      },
      onContextMenu: (e: React.MouseEvent) => stateRef.current && e.preventDefault(),
    }),
  };
}

// A note card. `ghost` draws the copy that follows the pointer while dragging.
function NoteCard({ n, showCategory, open, dragProps, ghost = false }: {
  n: NoteRow;
  showCategory: boolean;
  open?: () => void;
  dragProps?: Record<string, unknown>;
  ghost?: boolean;
}) {
  const [pending, start] = useTransition();
  const act = (patch: Record<string, unknown>) => start(async () => { await updateNoteAction(n.id, patch); });
  const items = n.items ?? [];
  return (
    <article
      {...dragProps}
      className={`group relative mb-3 break-inside-avoid select-none rounded-2xl border p-3.5 [-webkit-touch-callout:none] ${
        ghost ? "shadow-2xl ring-2 ring-accent" : "cursor-grab transition hover:shadow-md active:cursor-grabbing"
      } ${n.color === "default" ? "border-rule bg-surface" : "border-transparent"} ${pending ? "opacity-60" : ""}`}
      style={{ background: bg(n.color) }}
    >
      <button onClick={open} tabIndex={ghost ? -1 : undefined} className="block w-full cursor-[inherit] text-left" aria-label={`Open note ${n.title || ""}`.trim()}>
        {n.title && <h3 className="mb-1 pr-7 font-medium break-words">{n.title}</h3>}
        {n.items ? (
          <ul className="space-y-0.5 text-sm">
            {items.slice(0, 8).map((it, i) => (
              <li key={i} className={`flex gap-2 ${it.done ? "text-ink-3 line-through" : ""}`}>
                <span aria-hidden>{it.done ? "☑" : "☐"}</span>
                <span className="min-w-0 break-words">{it.text}</span>
              </li>
            ))}
            {items.length > 8 && <li className="text-xs text-ink-3">+{items.length - 8} more</li>}
          </ul>
        ) : (
          <p className="line-clamp-[12] whitespace-pre-wrap break-words text-sm">{n.body}</p>
        )}
      </button>
      {showCategory && n.categoryName && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink-2">
          <span className="size-1.5 rounded-full" style={{ background: n.categoryColor ?? undefined }} aria-hidden /> {n.categoryName}
        </span>
      )}
      {!n.archived && !ghost && (
        <button data-no-drag onClick={() => act({ pinned: !n.pinned })} aria-label={n.pinned ? "Unpin" : "Pin"} className={`absolute right-1.5 top-1.5 rounded-full p-1.5 text-ink-2 hover:bg-ink/5 ${n.pinned ? "" : "sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"}`}>
          <PushPin size={16} weight={n.pinned ? "fill" : "regular"} />
        </button>
      )}
      <div data-no-drag className={`-mb-1.5 mt-2 flex gap-0.5 sm:opacity-0 sm:transition sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 ${ghost ? "invisible" : ""}`}>
        <button onClick={() => act({ archived: !n.archived, pinned: false })} aria-label={n.archived ? "Unarchive" : "Archive"} title={n.archived ? "Unarchive" : "Archive"} className="rounded-full p-1.5 text-ink-2 hover:bg-ink/5">
          {n.archived ? <ArrowCounterClockwise size={16} /> : <Archive size={16} />}
        </button>
        <button onClick={() => start(async () => { await deleteNoteAction(n.id); })} aria-label="Delete note" title="Delete" className="rounded-full p-1.5 text-ink-2 hover:bg-ink/5 hover:text-danger">
          <Trash size={16} />
        </button>
      </div>
    </article>
  );
}

// Edits a note in a dialog; everything is saved together when it closes.
// The fields live in EditorBody (keyed by note, so it starts from that note)
// and report each change to `draftRef`, which the close handler saves.
function NoteEditor({ note, categories, onClose }: { note: NoteRow | null; categories: { id: string; name: string }[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const draftRef = useRef<(Draft & { categoryId: string | null }) | null>(null);
  const skipSave = useRef(false);
  const [, start] = useTransition();

  useEffect(() => {
    const el = dialog.current;
    if (note && el && !el.open) el.showModal();
  }, [note]);

  const save = () => {
    const d = draftRef.current;
    if (note && d && !skipSave.current) {
      const patch = { title: d.title, body: d.body, items: d.items, color: d.color, pinned: d.pinned, categoryId: d.categoryId };
      const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((k) => JSON.stringify(patch[k]) !== JSON.stringify(note[k]));
      if (changed) start(async () => { await updateNoteAction(note.id, patch); });
    }
    skipSave.current = false;
    onClose();
  };
  // Archive/delete close the editor without saving the draft over them.
  const finish = (fn: () => Promise<unknown>) => {
    skipSave.current = true;
    dialog.current?.close();
    start(async () => { await fn(); });
  };

  return (
    <dialog
      ref={dialog}
      onClose={save}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      aria-label="Edit note"
      className="sheet mx-0 mb-0 mt-auto max-h-[92dvh] w-full max-w-full overflow-y-auto rounded-t-[28px] bg-transparent p-0 text-ink backdrop:bg-black/40 sm:m-auto sm:max-w-xl"
    >
      {note && <EditorBody key={note.id} note={note} categories={categories} draftRef={draftRef} close={() => dialog.current?.close()} finish={finish} />}
    </dialog>
  );
}

function EditorBody({ note, categories, draftRef, close, finish }: {
  note: NoteRow;
  categories: { id: string; name: string }[];
  draftRef: React.RefObject<(Draft & { categoryId: string | null }) | null>;
  close: () => void;
  finish: (fn: () => Promise<unknown>) => void;
}) {
  const [d, setD] = useState({ title: note.title, body: note.body, items: note.items, color: note.color, pinned: note.pinned, categoryId: note.categoryId });
  useEffect(() => { draftRef.current = d; }, [d, draftRef]);
  const set = (patch: Partial<typeof d>) => setD((cur) => ({ ...cur, ...patch }));
  return (
    <div className="space-y-3 rounded-t-[28px] p-5 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-[24px] sm:pb-4" style={{ background: bg(d.color) ?? "var(--surface)" }}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2"><DraftFields d={d} set={set} /></div>
        <button type="button" onClick={() => set({ pinned: !d.pinned })} aria-pressed={d.pinned} aria-label={d.pinned ? "Unpin" : "Pin"} className="rounded-full p-2 text-ink-2 hover:bg-ink/5">
          <PushPin size={18} weight={d.pinned ? "fill" : "regular"} />
        </button>
      </div>
      <p className="text-right text-[11px] text-ink-3">Edited {new Date(note.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
      <div className="flex flex-wrap items-center gap-1">
        <ColorPicker value={d.color} onChange={(color) => set({ color })} />
        <button type="button" onClick={() => set(toggleChecklist(d))} aria-label={d.items ? "Show as text" : "Show as checklist"} title={d.items ? "Show as text" : "Show as checklist"} className="rounded-full p-2 text-ink-2 hover:bg-ink/5">
          <CheckSquare size={18} weight={d.items ? "fill" : "regular"} />
        </button>
        <select value={d.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value || null })} aria-label="Category" className="rounded-full border border-ink/15 bg-transparent px-3 py-1.5 text-xs">
          <option value="">No category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="button" onClick={() => finish(() => updateNoteAction(note.id, { archived: !note.archived, pinned: false }))} aria-label={note.archived ? "Unarchive" : "Archive"} title={note.archived ? "Unarchive" : "Archive"} className="rounded-full p-2 text-ink-2 hover:bg-ink/5">
          {note.archived ? <ArrowCounterClockwise size={18} /> : <Archive size={18} />}
        </button>
        <button type="button" onClick={() => finish(() => deleteNoteAction(note.id))} aria-label="Delete note" title="Delete" className="rounded-full p-2 text-ink-2 hover:bg-ink/5 hover:text-danger">
          <Trash size={18} />
        </button>
        <button type="button" onClick={close} className="btn ml-auto px-3 py-1.5 text-ink-2 hover:bg-ink/5">Close</button>
      </div>
    </div>
  );
}
