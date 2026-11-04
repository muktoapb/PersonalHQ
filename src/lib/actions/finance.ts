"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createCategory, createTransaction, deleteCategory, deleteTransaction, updateTransaction } from "@/lib/core/finance";
import type { FormState } from "./auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

const refresh = () => revalidatePath("/", "layout");

export async function saveTransactionAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireSession();
  const id = str(fd, "id");
  const fields = {
    date: str(fd, "date"),
    amount: str(fd, "amount"),
    description: str(fd, "description"),
    categoryId: str(fd, "categoryId") || null,
    // Absent when there are no wallets yet: leave the field alone.
    ...(fd.has("walletId") && { walletId: str(fd, "walletId") || null }),
  };
  const res = id ? await updateTransaction(id, fields) : await createTransaction({ ...fields, kind: str(fd, "kind") });
  if (!res.ok) return { error: res.error };
  refresh();
  return { ok: true };
}

export async function deleteTransactionAction(id: string) {
  await requireSession();
  const res = await deleteTransaction(id);
  refresh();
  return res.ok ? { ok: true } : { error: res.error };
}

// From a transaction form: create a category and hand back its id to select it.
export async function addCategoryAction(name: string, kind: string, color: string): Promise<FormState & { id?: string }> {
  await requireSession();
  const res = await createCategory({ name, kind, color });
  if (!res.ok) return { error: res.error };
  refresh();
  return { ok: true, id: res.id };
}

export async function deleteCategoryAction(id: string) {
  await requireSession();
  const res = await deleteCategory(id);
  refresh();
  return res.ok ? { ok: true } : { error: res.error };
}
