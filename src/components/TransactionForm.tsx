"use client";

import { useActionState, useState } from "react";
import { saveTransactionAction } from "@/lib/actions/finance";
import type { TransactionKind } from "@/db/schema";
import { fromMinor, KIND_META } from "@/lib/money";
import { CategoryPicker } from "./FinanceCategories";
import { useWallets } from "./WalletsContext";

type Cat = { id: string; name: string };
export type Editing = { id: string; date: string; amount: number; description: string | null; categoryId: string | null; walletId?: string | null };

export function TransactionForm(p: {
  kind: TransactionKind;
  categories: Cat[];
  currency: string;
  today: string;
  editing?: Editing;
  onDone?: () => void;
}) {
  const { onDone, editing } = p;
  const [amount, setAmount] = useState(editing ? String(fromMinor(editing.amount)) : "");
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(async (prev: { error?: string; ok?: boolean }, fd: FormData) => {
    const res = await saveTransactionAction(prev, fd);
    if (res.ok) {
      if (!editing) {
        setAmount("");
        setFormKey((k) => k + 1); // remount = fresh empty form
      }
      onDone?.();
    }
    return res;
  }, {});

  const meta = KIND_META[p.kind];
  // Active wallets, plus the entry's own wallet if it has since been archived.
  const wallets = useWallets().filter((w) => !w.archived || w.id === editing?.walletId);
  const walletDefault = editing ? (editing.walletId ?? "") : (wallets.find((w) => w.isDefault && !w.archived)?.id ?? "");

  return (
    <form key={formKey} action={action} className="space-y-3">
      <input type="hidden" name="kind" value={p.kind} />
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`amount-${editing?.id ?? "new"}`}>Amount ({p.currency})</label>
          <input
            id={`amount-${editing?.id ?? "new"}`} name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" required
            value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="0.00"
          />
        </div>
        <div>
          <label className="label" htmlFor={`date-${editing?.id ?? "new"}`}>Date</label>
          <input id={`date-${editing?.id ?? "new"}`} name="date" type="date" required defaultValue={editing?.date ?? p.today} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={`cat-${editing?.id ?? "new"}`}>Category</label>
          <CategoryPicker id={`cat-${editing?.id ?? "new"}`} kind={p.kind} categories={p.categories} defaultValue={editing?.categoryId ?? ""} />
        </div>
        {wallets.length > 0 && (
          <div>
            <label className="label" htmlFor={`wallet-${editing?.id ?? "new"}`}>{p.kind === "income" ? "Into wallet" : "From wallet"}</label>
            <select id={`wallet-${editing?.id ?? "new"}`} name="walletId" defaultValue={walletDefault} className="input">
              <option value="">No wallet</option>
              {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}{w.archived ? " (archived)" : ""}</option>)}
            </select>
          </div>
        )}
        <div className={wallets.length > 0 ? "sm:col-span-2" : undefined}>
          <label className="label" htmlFor={`desc-${editing?.id ?? "new"}`}>Note</label>
          <input id={`desc-${editing?.id ?? "new"}`} name="description" maxLength={500} defaultValue={editing?.description ?? ""} className="input" placeholder="What was it for?" />
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : editing ? "Save changes" : `Add ${meta.label.toLowerCase()}`}</button>
        {editing && <button type="button" onClick={onDone} className="btn btn-ghost">Cancel</button>}
      </div>
    </form>
  );
}
