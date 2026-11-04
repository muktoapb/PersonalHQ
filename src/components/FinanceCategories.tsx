"use client";

import { Plus, X } from "@phosphor-icons/react/ssr";
import { useState, useTransition } from "react";
import type { TransactionKind } from "@/db/schema";
import { addCategoryAction, deleteCategoryAction } from "@/lib/actions/finance";
import { GROUP_COLORS } from "@/lib/group-icons";

type Cat = { id: string; name: string; color?: string };

const NEW = "__new";

// Category select for a transaction form, with "+ New category…" to create one
// on the spot (it is selected right away).
export function CategoryPicker({ kind, categories, defaultValue, id }: { kind: TransactionKind; categories: Cat[]; defaultValue: string; id: string }) {
  const [value, setValue] = useState(defaultValue);
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<Cat[]>([]); // shown until the page refreshes with them
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const all = [...categories, ...created.filter((c) => !categories.some((x) => x.id === c.id))];

  const create = (name: string) =>
    start(async () => {
      const r = await addCategoryAction(name, kind, GROUP_COLORS[all.length % GROUP_COLORS.length]);
      setError(r.error);
      if (r.id) {
        setCreated((c) => [...c, { id: r.id!, name: name.trim() }]);
        setValue(r.id);
        setAdding(false);
      }
    });

  return (
    <>
      {/* The submitted value; the visible control is the select or the new-category field. */}
      <input type="hidden" name="categoryId" value={value} />
      {adding ? (
        <div className="flex gap-1.5">
          <input
            id={id}
            autoFocus
            maxLength={60}
            placeholder="New category name"
            aria-label="New category name"
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); if (e.currentTarget.value.trim()) create(e.currentTarget.value); }
              if (e.key === "Escape") setAdding(false);
            }}
            className="input min-w-0"
          />
          <button
            type="button"
            disabled={pending}
            onClick={(e) => { const input = (e.currentTarget.previousSibling as HTMLInputElement); if (input.value.trim()) create(input.value); }}
            className="btn btn-primary shrink-0 px-3"
          >
            {pending ? "…" : "Add"}
          </button>
          <button type="button" onClick={() => setAdding(false)} aria-label="Cancel" className="rounded-full p-2 text-ink-3 hover:bg-surface-2"><X size={16} /></button>
        </div>
      ) : (
        <select id={id} value={value} onChange={(e) => (e.target.value === NEW ? setAdding(true) : setValue(e.target.value))} className="input">
          <option value="">No category</option>
          {all.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value={NEW}>+ New category…</option>
        </select>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </>
  );
}

// A finance page's categories: see them, add one, delete one (its
// transactions keep their amounts and become uncategorised).
export function KindCategories({ kind, categories }: { kind: TransactionKind; categories: Required<Cat>[] }) {
  const [color, setColor] = useState(GROUP_COLORS[categories.length % GROUP_COLORS.length]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {categories.length ? (
        <ul className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-rule py-1 pl-3 pr-1 text-sm">
              <span className="size-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
              {c.name}
              {confirming === c.id ? (
                <>
                  <button disabled={pending} onClick={() => start(async () => { const r = await deleteCategoryAction(c.id); setError(r.error); setConfirming(null); })} className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">Delete</button>
                  <button onClick={() => setConfirming(null)} className="rounded-full px-2 py-0.5 text-xs text-ink-3 hover:bg-surface-2">Keep</button>
                </>
              ) : (
                <button onClick={() => setConfirming(c.id)} aria-label={`Delete ${c.name}`} className="rounded-full p-1 text-ink-3 hover:bg-danger/10 hover:text-danger"><X size={12} weight="bold" /></button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">No categories yet.</p>
      )}
      <form
        action={(fd) =>
          start(async () => {
            const r = await addCategoryAction(String(fd.get("name") ?? ""), kind, color);
            setError(r.error);
            if (!r.error) setColor(GROUP_COLORS[(categories.length + 1) % GROUP_COLORS.length]);
          })
        }
        className="flex flex-wrap items-center gap-2"
      >
        <input name="name" required maxLength={60} placeholder="New category, e.g. Groceries" aria-label="New category" className="input min-w-0 flex-1 basis-48 py-2" />
        <div className="flex gap-1" role="radiogroup" aria-label="Colour">
          {GROUP_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
              className={`size-6 rounded-full ring-offset-2 ring-offset-surface ${color === c ? "ring-2 ring-ink" : ""}`} style={{ background: c }} />
          ))}
        </div>
        <button disabled={pending} className="btn btn-ghost px-3 py-2"><Plus size={16} weight="bold" /> Add</button>
      </form>
      {confirming && <p className="text-xs text-ink-3">Its transactions are kept and become uncategorised.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
