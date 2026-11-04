"use client";

import { Cardholder, PencilSimple, Trash } from "@phosphor-icons/react/ssr";
import { useState, useTransition } from "react";
import { deleteTransactionAction } from "@/lib/actions/finance";
import type { TransactionKind } from "@/db/schema";
import { formatMoney, KIND_META } from "@/lib/money";
import { AppIcon } from "./AppIcon";
import { TransactionForm } from "./TransactionForm";

type Row = {
  id: string;
  kind: TransactionKind;
  date: string;
  amount: number;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  walletId?: string | null;
  walletName?: string | null;
};

export function TransactionList(p: {
  rows: Row[];
  currency: string;
  locale: string;
  symbol?: string | null;
  today: string;
  categories: Record<string, { id: string; name: string }[]>;
  showKind?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fmt = (m: number) => formatMoney(m, p.currency, p.locale, p.symbol);

  if (!p.rows.length) return <p className="py-8 text-center text-sm text-ink-3">Nothing here yet.</p>;

  return (
    <ul className="space-y-2">
      {p.rows.map((r) =>
        editing === r.id ? (
          <li key={r.id} className="rounded-2xl border border-accent/50 p-4 ring-2 ring-accent/10">
            <TransactionForm
              kind={r.kind} categories={p.categories[r.kind] ?? []} currency={p.symbol || p.currency}
              today={p.today} editing={r} onDone={() => setEditing(null)}
            />
          </li>
        ) : (
          <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-rule px-3 py-2.5 transition hover:border-accent/40">
            <AppIcon name={KIND_META[r.kind].icon} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.description || r.categoryName || KIND_META[r.kind].label}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                <span className="whitespace-nowrap">{r.date}</span>
                {r.categoryName && (
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full" style={{ background: r.categoryColor ?? undefined }} />
                    {r.categoryName}
                  </span>
                )}
                {r.walletName && <span className="inline-flex items-center gap-1"><Cardholder size={12} aria-hidden />{r.walletName}</span>}
                {p.showKind && <span>{KIND_META[r.kind].label}</span>}
              </p>
            </div>
            {/* phones: actions sit under the amount to leave room for the name */}
            <div className="flex shrink-0 flex-col items-end sm:flex-row sm:items-center sm:gap-3">
              <span className="whitespace-nowrap font-medium tabular-nums" style={{ color: `var(--${r.kind})` }}>
                {r.kind === "income" ? "+" : "−"}{fmt(r.amount)}
              </span>
              <div className="-mr-1.5 flex gap-0.5 sm:mr-0 sm:gap-1">
                {confirming === r.id ? (
                  <>
                    <button
                      disabled={pending}
                      onClick={() => start(async () => { await deleteTransactionAction(r.id); setConfirming(null); })}
                      className="btn btn-danger px-3 py-1 text-xs"
                    >
                      Delete
                    </button>
                    <button onClick={() => setConfirming(null)} className="btn btn-ghost px-3 py-1 text-xs">Keep</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setEditing(r.id)} aria-label="Edit" className="rounded-full p-1.5 sm:p-2 text-ink-3 transition hover:bg-surface-2 hover:text-ink"><PencilSimple size={16} weight="bold" /></button>
                    <button onClick={() => setConfirming(r.id)} aria-label="Delete" className="rounded-full p-1.5 sm:p-2 text-ink-3 transition hover:bg-danger/10 hover:text-danger"><Trash size={16} weight="bold" /></button>
                  </>
                )}
              </div>
            </div>
          </li>
        ),
      )}
    </ul>
  );
}
