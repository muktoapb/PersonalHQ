"use client";

import { ArrowsLeftRight, Archive, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react/ssr";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { WALLET_TYPES, type WalletType } from "@/db/schema";
import { adjustBalanceAction, archiveWalletAction, deleteTransferAction, deleteWalletAction, saveWalletAction, transferAction } from "@/lib/actions/wallets";
import { GROUP_COLORS } from "@/lib/group-icons";
import { fromMinor } from "@/lib/money";
import { WALLET_TYPE_META, type WalletOption } from "@/lib/wallets";
import { AppIcon } from "./AppIcon";

// Wallet dialogs and small controls: add/edit a wallet, move money between
// wallets, set a wallet's real balance, archive/delete, delete a transfer.

const DIALOG =
  "sheet mx-0 mb-0 mt-auto max-h-[92dvh] w-full max-w-full overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink backdrop:bg-black/40 sm:m-auto sm:max-w-md sm:rounded-[28px] sm:p-6";

function Header({ title, icon, color, onClose }: { title: string; icon: Parameters<typeof AppIcon>[0]["name"]; color?: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <AppIcon name={icon} size={44} color={color} />
      <h2 className="flex-1 text-lg font-medium">{title}</h2>
      <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 rounded-full p-2 text-ink-3 hover:bg-surface-2"><X size={20} /></button>
    </div>
  );
}

type EditableWallet = { id: string; name: string; type: WalletType; color: string; openingBalance: number; isDefault: boolean };

// New wallet (no `wallet`) or edit one. `trigger`: a dashed card, a button,
// or a pencil.
export function WalletDialog({ wallet, trigger, currency }: { wallet?: EditableWallet; trigger: "card" | "button" | "edit"; currency: string }) {
  const [state, action, pending] = useActionState(saveWalletAction, {});
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (state.ok) dialog.current?.close(); }, [state]);
  const [type, setType] = useState<WalletType>(wallet?.type ?? "bank");
  const [color, setColor] = useState(wallet?.color ?? GROUP_COLORS[1]);
  const id = wallet?.id ?? "new";

  return (
    <>
      {trigger === "card" ? (
        <button onClick={() => dialog.current?.showModal()} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-accent/40 p-4 text-sm font-medium text-accent-text transition hover:border-accent hover:bg-surface/60">
          <span className="grid size-10 place-items-center rounded-full bg-accent-strong text-white shadow-md shadow-accent-strong/30"><Plus size={18} weight="bold" /></span>
          Add wallet
        </button>
      ) : trigger === "edit" ? (
        <button onClick={() => dialog.current?.showModal()} className="btn btn-ghost"><PencilSimple size={16} /> Edit</button>
      ) : (
        <button onClick={() => dialog.current?.showModal()} className="btn btn-primary"><Plus size={16} weight="bold" /> Add wallet</button>
      )}
      <dialog ref={dialog} onClick={(e) => e.target === dialog.current && dialog.current?.close()} aria-label={wallet ? "Edit wallet" : "New wallet"} className={DIALOG}>
        <form action={action} className="space-y-5">
          {wallet && <input type="hidden" name="id" value={wallet.id} />}
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="color" value={color} />
          <Header title={wallet ? "Edit wallet" : "New wallet"} icon={WALLET_TYPE_META[type].icon} color={color} onClose={() => dialog.current?.close()} />

          <fieldset>
            <legend className="label">Type</legend>
            <div className="grid grid-cols-3 gap-2">
              {WALLET_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  className={`flex flex-col items-center gap-1 rounded-2xl border p-2.5 text-xs transition ${type === t ? "border-accent bg-accent-soft font-medium" : "border-rule hover:border-accent/40"}`}
                >
                  <AppIcon.Glyph name={WALLET_TYPE_META[t].icon} size={20} weight={type === t ? "fill" : "regular"} />
                  {WALLET_TYPE_META[t].label}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="label" htmlFor={`wname-${id}`}>Name</label>
            <input id={`wname-${id}`} name="name" required maxLength={40} defaultValue={wallet?.name} placeholder={WALLET_TYPE_META[type].hint} className="input" />
          </div>

          <div>
            <label className="label" htmlFor={`wbal-${id}`}>{wallet ? `Starting balance (${currency})` : `Current balance (${currency})`}</label>
            <input
              id={`wbal-${id}`} name="openingBalance" type="number" inputMode="decimal" step="0.01"
              defaultValue={wallet ? fromMinor(wallet.openingBalance) : ""} placeholder="0.00" className="input"
            />
            <p className="mt-1.5 text-xs text-ink-3">
              {wallet
                ? "What it held before any entries here. To fix today's balance, use “Set balance” on the wallet instead."
                : "What's in it right now. New income and spending tagged with this wallet will change it from here."}
            </p>
          </div>

          <div>
            <span className="label">Colour</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
              {GROUP_COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
                  className={`size-8 rounded-full ring-offset-2 ring-offset-surface ${color === c ? "ring-2 ring-ink" : ""}`} style={{ background: c }} />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isDefault" defaultChecked={wallet?.isDefault} className="accent-accent" />
            Use by default for new entries
          </label>

          {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
          <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : wallet ? "Save" : "Create wallet"}</button>
        </form>
      </dialog>
    </>
  );
}

// Move money from one wallet to another, with an optional fee.
export function TransferDialog({ wallets, currency, today, from }: { wallets: WalletOption[]; currency: string; today: string; from?: string }) {
  const [state, action, pending] = useActionState(transferAction, {});
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (state.ok) dialog.current?.close(); }, [state]);
  const active = wallets.filter((w) => !w.archived);
  const first = from ?? active.find((w) => w.isDefault)?.id ?? active[0]?.id;
  if (active.length < 2) return null;
  return (
    <>
      <button onClick={() => dialog.current?.showModal()} className="btn btn-ghost"><ArrowsLeftRight size={16} /> Transfer</button>
      <dialog ref={dialog} onClick={(e) => e.target === dialog.current && dialog.current?.close()} aria-label="Transfer" className={DIALOG}>
        <form action={action} className="space-y-4">
          <Header title="Move money" icon="transfer" onClose={() => dialog.current?.close()} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="tr-from">From</label>
              <select id="tr-from" name="from" defaultValue={first} className="input">
                {active.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="tr-to">To</label>
              <select id="tr-to" name="to" defaultValue={active.find((w) => w.id !== first)?.id} className="input">
                {active.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="tr-amount">Amount ({currency})</label>
              <input id="tr-amount" name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" required placeholder="0.00" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="tr-fee">Fee (optional)</label>
              <input id="tr-fee" name="fee" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="tr-date">Date</label>
              <input id="tr-date" name="date" type="date" required defaultValue={today} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="tr-note">Note</label>
              <input id="tr-note" name="note" maxLength={200} placeholder="e.g. ATM withdrawal" className="input" />
            </div>
          </div>
          <p className="text-xs text-ink-3">A fee (bank charge, cash-out fee) is recorded as an expense from the first wallet. Transfers don&apos;t count as income or spending.</p>
          {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
          <button disabled={pending} className="btn btn-primary">{pending ? "Moving…" : "Move money"}</button>
        </form>
      </dialog>
    </>
  );
}

// "Set balance": record the difference to what the wallet really holds.
export function AdjustBalance({ walletId, balance, currency }: { walletId: string; balance: number; currency: string }) {
  const [state, action, pending] = useActionState(adjustBalanceAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={action} className="space-y-2">
      <input type="hidden" name="walletId" value={walletId} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <label className="label" htmlFor="actual">Actual balance ({currency})</label>
          <input id="actual" name="actual" type="number" inputMode="decimal" step="0.01" required placeholder={String(fromMinor(balance))} className="input" />
        </div>
        <button disabled={pending} className="btn btn-ghost">{pending ? "Saving…" : "Set balance"}</button>
      </div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-income">Balance updated — the difference is recorded as an adjustment.</p>}
    </form>
  );
}

export function WalletArchiveButtons({ id, archived, canDelete }: { id: string; archived: boolean; canDelete: boolean }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button disabled={pending} onClick={() => start(async () => setError((await archiveWalletAction(id, !archived)).error))} className="btn btn-ghost">
        <Archive size={16} /> {archived ? "Restore" : "Archive"}
      </button>
      {canDelete &&
        (confirming ? (
          <>
            <button disabled={pending} onClick={() => start(async () => setError((await deleteWalletAction(id)).error))} className="btn btn-danger">Delete wallet</button>
            <button onClick={() => setConfirming(false)} className="btn btn-ghost">Keep</button>
          </>
        ) : (
          <button onClick={() => setConfirming(true)} className="btn btn-danger"><Trash size={16} /> Delete</button>
        ))}
      {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}

export function DeleteTransfer({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  return confirming ? (
    <span className="flex gap-1">
      <button disabled={pending} onClick={() => start(async () => { await deleteTransferAction(id); })} className="btn btn-danger px-3 py-1 text-xs">Delete</button>
      <button onClick={() => setConfirming(false)} className="btn btn-ghost px-3 py-1 text-xs">Keep</button>
    </span>
  ) : (
    <button onClick={() => setConfirming(true)} aria-label={`Delete ${label}`} className="rounded-full p-1.5 text-ink-3 hover:bg-danger/10 hover:text-danger"><Trash size={16} /></button>
  );
}
