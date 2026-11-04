"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { type ImportCounts, importAll } from "@/lib/core/backup";
import { createMcpToken, revokeMcpToken } from "@/lib/mcp/auth";
import { verifySecret } from "@/lib/secrets";

export type ImportState = { error?: string; counts?: ImportCounts };

export async function importBackupAction(_: ImportState, fd: FormData): Promise<ImportState> {
  await requireSession();
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a backup file." };
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return { error: "That file isn't valid JSON." };
  }
  const r = await importAll(json);
  if (!r.ok) return { error: r.error };
  revalidatePath("/", "layout");
  return { counts: r.counts };
}

// The new token is returned once, to be copied; only its hash is kept. It
// needs the password: a token outlives sign-outs, so a borrowed session
// shouldn't be enough to mint one.
export async function createMcpTokenAction(password: string): Promise<{ token?: string; error?: string }> {
  const s = await requireSession();
  if (!(await verifySecret(password, s.passwordHash))) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Password is wrong." };
  }
  const token = await createMcpToken();
  revalidatePath("/settings/mcp");
  return { token };
}

export async function revokeMcpTokenAction() {
  await requireSession();
  await revokeMcpToken();
  revalidatePath("/settings/mcp");
}
