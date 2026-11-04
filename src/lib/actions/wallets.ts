"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { adjustBalance, createTransfer, createWallet, deleteTransfer, deleteWallet, setWalletArchived, updateWallet } from "@/lib/core/wallets";
import { today } from "@/lib/dates";
import type { FormState } from "./auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const refresh = () => revalidatePath("/", "layout");

// Create (no id) or edit a wallet from its dialog.
export async function saveWalletAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
  const id = str(fd, "id");
  const fields = {
    name: str(fd, "name"),
    type: str(fd, "type"),
    color: str(fd, "color"),
    openingBalance: str(fd, "openingBalance") || "0",
    isDefault: fd.get("isDefault") === "on",
  };
  const res = id ? await updateWallet(id, fields) : await createWallet(fields);
  if (!res.ok) return { error: res.error };
  refresh();
  return { ok: true };
}

export async function archiveWalletAction(id: string, archived: boolean): Promise<FormState> {
  await requireSession();
  const res = await setWalletArchived(id, archived);
  refresh();
  return res.ok ? { ok: true } : { error: res.error };
}

export async function deleteWalletAction(id: string): Promise<FormState> {
  await requireSession();
  const res = await deleteWallet(id);
  if (!res.ok) return { error: res.error };
  refresh();
  redirect("/finance/wallets");
}

export async function transferAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
  const res = await createTransfer({
    fromWalletId: str(fd, "from"),
    toWalletId: str(fd, "to"),
    amount: str(fd, "amount"),
    fee: str(fd, "fee") || "0",
    date: str(fd, "date"),
    note: str(fd, "note"),
  });
  if (!res.ok) return { error: res.error };
  refresh();
  return { ok: true };
}

export async function adjustBalanceAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
  const res = await adjustBalance(str(fd, "walletId"), str(fd, "actual"), today());
  if (!res.ok) return { error: res.error };
  refresh();
  return { ok: true };
}

export async function deleteTransferAction(id: string): Promise<FormState> {
  await requireSession();
  const res = await deleteTransfer(id);
  refresh();
  return res.ok ? { ok: true } : { error: res.error };
}
