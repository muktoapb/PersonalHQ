"use client";

import { ArrowLeft, Plus, X } from "@phosphor-icons/react/ssr";
import { useRef, useState } from "react";
import type { TransactionKind } from "@/db/schema";
import { KIND_META } from "@/lib/money";
import { AppIcon } from "./AppIcon";
import { TransactionForm } from "./TransactionForm";

type Props = {
  kinds: TransactionKind[];
  categories: Partial<Record<TransactionKind, { id: string; name: string }[]>>;
  currency: string;
  today: string;
  // Fixed kind (e.g. on the Expenses page); otherwise the sheet asks first.
  kind?: TransactionKind;
};

// Phones only: a floating + button that opens the add form as a bottom sheet.
export function QuickAdd({ kinds, categories, currency, today, kind }: Props) {
  const sheet = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState<TransactionKind | undefined>(kind);
  const close = () => sheet.current?.close();
  const open = () => {
    sheet.current?.showModal();
    sheet.current?.querySelector<HTMLInputElement>("input[name=amount]")?.focus(); // straight to typing
  };

  return (
    <>
      <button
        onClick={open}
        aria-label={kind ? `Add ${KIND_META[kind].label.toLowerCase()}` : "Add"}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex size-14 items-center justify-center rounded-full border border-black/20 bg-accent-strong text-white shadow-xl shadow-accent-strong/40 active:scale-95 md:hidden"
      >
        <Plus size={26} weight="bold" />
      </button>
      <dialog
        ref={sheet}
        onClose={() => setPicked(kind)}
        onClick={(e) => e.target === sheet.current && close()}
        aria-label="Add"
        className="sheet mx-0 mb-0 mt-auto max-h-[90dvh] w-full max-w-full rounded-t-[28px] bg-surface px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 text-ink backdrop:bg-black/40 md:hidden"
      >
        <div className="mb-4 flex items-center gap-2">
          {picked && !kind && (
            <button onClick={() => setPicked(undefined)} aria-label="Back" className="-ml-2 rounded-full p-2 text-ink-3">
              <ArrowLeft size={20} />
            </button>
          )}
          <h2 className="text-lg font-medium">{picked ? `Add ${KIND_META[picked].label.toLowerCase()}` : "Add"}</h2>
          <button onClick={close} aria-label="Close" className="-mr-2 ml-auto rounded-full p-2 text-ink-3">
            <X size={20} />
          </button>
        </div>
        {picked ? (
          <TransactionForm key={picked} kind={picked} categories={categories[picked] ?? []} currency={currency} today={today} onDone={close} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {kinds.map((k) => (
              <button key={k} onClick={() => { setPicked(k); requestAnimationFrame(() => sheet.current?.querySelector<HTMLInputElement>("input[name=amount]")?.focus()); }} className="flex items-center gap-3 rounded-2xl border border-rule p-3 text-left text-sm font-medium active:bg-surface-2">
                <AppIcon name={KIND_META[k].icon} size={36} />
                {KIND_META[k].label}
              </button>
            ))}
          </div>
        )}
      </dialog>
    </>
  );
}
