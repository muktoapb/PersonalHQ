"use client";

import { Check, Funnel, X } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { RANGE_PRESETS, type RangeKey } from "@/lib/analytics";

// Phones and tablets: the analytics range behind a filter button, in a sheet
// (like the Notes/Tasks menu). Desktop shows the row of range buttons instead.
export function RangeFilter({ current, label, from, to, max }: { current: RangeKey; label: string; from: string; to: string; max: string }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const params = useSearchParams();
  useEffect(() => sheet.current?.close(), [params]); // picked a range: close

  return (
    <>
      <button
        type="button"
        onClick={() => sheet.current?.showModal()}
        aria-label={`Filter: ${label}`}
        aria-haspopup="dialog"
        className="ml-auto grid size-10 shrink-0 place-items-center rounded-full border border-rule bg-surface text-ink-2 lg:hidden"
      >
        <Funnel size={18} />
      </button>
      <dialog
        ref={sheet}
        aria-label="Date range"
        onClick={(e) => e.target === sheet.current && sheet.current?.close()}
        className="sheet mx-0 mb-0 mt-auto max-h-[85dvh] w-full max-w-full overflow-y-auto rounded-t-[28px] bg-app px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 text-ink backdrop:bg-black/40 sm:m-auto sm:max-w-md sm:rounded-[28px] lg:hidden"
      >
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-xl font-semibold">Date range</h2>
          <button type="button" onClick={() => sheet.current?.close()} aria-label="Close" className="rounded-full bg-surface-2 p-1.5 text-ink-3"><X size={16} weight="bold" /></button>
        </div>
        <ul className="divide-y divide-rule overflow-hidden rounded-3xl border border-rule bg-surface">
          {RANGE_PRESETS.filter((p) => p.key !== "custom").map((p) => (
            <li key={p.key}>
              <Link href={`?range=${p.key}`} aria-current={p.key === current ? "page" : undefined} className="flex items-center gap-3 px-4 py-3.5 text-[15px] active:bg-surface-2">
                <span className={`flex-1 ${p.key === current ? "font-medium" : ""}`}>{p.label}</span>
                {p.key === current && <Check size={18} weight="bold" className="text-accent-text" />}
              </Link>
            </li>
          ))}
        </ul>
        <form className={`mt-4 space-y-3 rounded-3xl border bg-surface p-4 ${current === "custom" ? "border-accent/50" : "border-rule"}`}>
          <input type="hidden" name="range" value="custom" />
          <p className="flex items-center justify-between text-[15px] font-medium">
            Custom dates
            {current === "custom" && <Check size={18} weight="bold" className="text-accent-text" />}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="m-from">From</label>
              <input id="m-from" name="from" type="date" defaultValue={from} max={max} required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="m-to">To</label>
              <input id="m-to" name="to" type="date" defaultValue={to} max={max} required className="input" />
            </div>
          </div>
          <button className="btn btn-primary w-full">Apply</button>
          <p className="text-xs text-ink-3">Up to 3 years. Ranges over 2 months are shown by month.</p>
        </form>
      </dialog>
    </>
  );
}
