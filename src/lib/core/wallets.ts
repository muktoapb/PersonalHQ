import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { transactions, WALLET_TYPES, walletTransfers, wallets } from "@/db/schema";
import { toMinor } from "@/lib/money";
import { type Result, fail } from "./result";

// Wallets (bank accounts, cash, bKash…), their balances, transfers between
// them and balance adjustments. Money is in minor units throughout.

const name = z.string().trim().min(1, "Name required.").max(40);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const money = z.coerce.number().finite("Enter an amount.").min(-1_000_000_000).max(1_000_000_000);
const ymd = z.iso.date("Pick a date.");

// Create fills defaults; the patch must not (zod applies defaults even inside
// .partial(), which would reset fields a patch leaves out).
const walletFields = { name, type: z.enum(WALLET_TYPES), color, openingBalance: money, isDefault: z.boolean() };
export const walletSchema = z.object({
  ...walletFields,
  type: walletFields.type.default("bank"),
  color: color.default("#7262ea"),
  openingBalance: money.default(0),
  isDefault: walletFields.isDefault.default(false),
});
export const walletPatchSchema = z.object(walletFields).partial();

// ---------- reading ----------

// The outer wallet's id, table-qualified: drizzle prints a bare "id" in a
// single-table select, which inside these subqueries would mean their own id.
const WID = sql.raw(`"wallets"."id"`);

// Each wallet with its balance and this month's money in and out.
export async function listWallets(opts: { archived?: boolean; monthFrom?: string } = {}) {
  const from = opts.monthFrom ?? "9999-12-31";
  const rows = await db
    .select({
      id: wallets.id,
      name: wallets.name,
      type: wallets.type,
      color: wallets.color,
      openingBalance: wallets.openingBalance,
      isDefault: wallets.isDefault,
      archived: wallets.archived,
      position: wallets.position,
      createdAt: wallets.createdAt,
      balance: sql<number>`"wallets"."opening_balance"
        + coalesce((select sum(case when t.kind = 'income' then t.amount else -t.amount end) from transactions t where t.wallet_id = ${WID}), 0)
        + coalesce((select sum(x.amount) from wallet_transfers x where x.to_wallet_id = ${WID}), 0)
        - coalesce((select sum(x.amount) from wallet_transfers x where x.from_wallet_id = ${WID}), 0)`,
      monthIn: sql<number>`coalesce((select sum(t.amount) from transactions t where t.wallet_id = ${WID} and t.kind = 'income' and t.date >= ${from}), 0)`,
      monthOut: sql<number>`coalesce((select sum(t.amount) from transactions t where t.wallet_id = ${WID} and t.kind != 'income' and t.date >= ${from}), 0)`,
    })
    .from(wallets)
    .where(opts.archived === undefined ? undefined : eq(wallets.archived, opts.archived))
    .orderBy(asc(wallets.archived), asc(wallets.position), asc(wallets.createdAt));
  return rows.map((r) => ({ ...r, balance: Number(r.balance), monthIn: Number(r.monthIn), monthOut: Number(r.monthOut) }));
}
export type WalletRow = Awaited<ReturnType<typeof listWallets>>[number];

export async function getWallet(id: string) {
  return (await listWallets()).find((w) => w.id === id) ?? null;
}

// Pickers: id, name, type, whether it's the default, whether it's archived.
export const walletOptions = () =>
  db
    .select({ id: wallets.id, name: wallets.name, type: wallets.type, color: wallets.color, isDefault: wallets.isDefault, archived: wallets.archived })
    .from(wallets)
    .orderBy(asc(wallets.archived), asc(wallets.position), asc(wallets.createdAt));

// One wallet's history: its transactions and transfers, newest first.
export type HistoryRow = {
  type: "tx" | "transfer";
  id: string;
  date: string;
  kind: string | null; // transactions: income/expense/…; transfers: "in" | "out"
  amount: number;
  description: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  otherWalletId: string | null; // transfers: the wallet on the other side (null: adjustment)
};
export async function walletHistory(walletId: string, limit: number, offset: number) {
  const [rows, [{ n }]] = await Promise.all([
    db.all<HistoryRow>(sql`
      select 'tx' as type, t.id, t.date, t.created_at as createdAt, t.kind, t.amount, t.description,
             c.name as categoryName, c.color as categoryColor, null as otherWalletId
      from transactions t left join categories c on c.id = t.category_id
      where t.wallet_id = ${walletId}
      union all
      select 'transfer', x.id, x.date, x.created_at, case when x.to_wallet_id = ${walletId} then 'in' else 'out' end, x.amount, x.note,
             null, null, case when x.to_wallet_id = ${walletId} then x.from_wallet_id else x.to_wallet_id end
      from wallet_transfers x
      where x.from_wallet_id = ${walletId} or x.to_wallet_id = ${walletId}
      order by date desc, createdAt desc
      limit ${limit} offset ${offset}`),
    db.all<{ n: number }>(sql`
      select (select count(*) from transactions where wallet_id = ${walletId})
           + (select count(*) from wallet_transfers where from_wallet_id = ${walletId} or to_wallet_id = ${walletId}) as n`),
  ]);
  return { rows, total: Number(n) };
}

export const recentTransfers = (limit = 10) =>
  db.select().from(walletTransfers).orderBy(sql`${walletTransfers.date} desc, ${walletTransfers.createdAt} desc`).limit(limit);

// ---------- writing ----------

// Only one default wallet: making `keep` the default clears the rest.
const clearDefault = (keep: string) => db.update(wallets).set({ isDefault: false }).where(and(eq(wallets.isDefault, true), ne(wallets.id, keep)));

export async function createWallet(input: unknown): Promise<Result<{ id: string }>> {
  const p = walletSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const { openingBalance, ...w } = p.data;
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(wallets);
  const id = crypto.randomUUID();
  const first = Number(count) === 0; // the first wallet is the default
  await db.batch([
    db.insert(wallets).values({ ...w, id, isDefault: w.isDefault || first, openingBalance: toMinor(openingBalance), position: Number(count) }),
    ...(w.isDefault ? [clearDefault(id)] : []),
  ]);
  return { ok: true, id };
}

export async function updateWallet(id: string, input: unknown): Promise<Result> {
  const p = walletPatchSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const { openingBalance, ...w } = p.data;
  const patch = { ...w, ...(openingBalance !== undefined && { openingBalance: toMinor(openingBalance) }) };
  const update = db.update(wallets).set(patch).where(eq(wallets.id, id));
  const res = w.isDefault ? (await db.batch([update, clearDefault(id)]))[0] : await update;
  return res.rowsAffected ? { ok: true } : fail("Wallet not found.");
}

// Archived wallets keep their history and balance but leave the pickers.
export async function setWalletArchived(id: string, archived: boolean): Promise<Result> {
  const res = await db.update(wallets).set({ archived, ...(archived && { isDefault: false }) }).where(eq(wallets.id, id));
  return res.rowsAffected ? { ok: true } : fail("Wallet not found.");
}

// Only an unused wallet can be deleted; otherwise archive it.
export async function deleteWallet(id: string): Promise<Result> {
  const [{ n }] = await db.all<{ n: number }>(sql`
    select (select count(*) from transactions where wallet_id = ${id})
         + (select count(*) from wallet_transfers where from_wallet_id = ${id} or to_wallet_id = ${id}) as n`);
  if (Number(n) > 0) return fail("This wallet has history — archive it instead.");
  const res = await db.delete(wallets).where(eq(wallets.id, id));
  return res.rowsAffected ? { ok: true } : fail("Wallet not found.");
}

async function activeWallet(id: string) {
  const [w] = await db.select({ id: wallets.id, name: wallets.name, archived: wallets.archived }).from(wallets).where(eq(wallets.id, id));
  return w && !w.archived ? w : null;
}

export const transferSchema = z.object({
  fromWalletId: z.string(),
  toWalletId: z.string(),
  amount: money.refine((v) => v > 0, "Amount must be more than 0."),
  fee: money.refine((v) => v >= 0, "Fee can't be negative.").default(0),
  date: ymd,
  note: z.string().trim().max(200).optional().transform((v) => v || null),
});

// Move money between two wallets; a fee is an expense from the source.
export async function createTransfer(input: unknown): Promise<Result<{ id: string }>> {
  const p = transferSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const t = p.data;
  if (t.fromWalletId === t.toWalletId) return fail("Pick two different wallets.");
  const [from, to] = await Promise.all([activeWallet(t.fromWalletId), activeWallet(t.toWalletId)]);
  if (!from || !to) return fail("Wallet not found.");
  const id = crypto.randomUUID();
  const feeId = t.fee > 0 ? crypto.randomUUID() : null;
  await db.batch([
    db.insert(walletTransfers).values({ id, fromWalletId: from.id, toWalletId: to.id, amount: toMinor(t.amount), date: t.date, note: t.note, feeTransactionId: feeId }),
    ...(feeId
      ? [db.insert(transactions).values({ id: feeId, kind: "expense", date: t.date, amount: toMinor(t.fee), description: `Transfer fee: ${from.name} → ${to.name}`, walletId: from.id })]
      : []),
  ]);
  return { ok: true, id };
}

// Set a wallet's balance to what it really is: records the difference as an
// adjustment (a one-sided transfer) dated today.
export async function adjustBalance(walletId: string, actual: unknown, date: string): Promise<Result<{ difference: number }>> {
  const a = money.safeParse(actual);
  if (!a.success) return fail(a.error.issues[0].message);
  const w = await getWallet(walletId);
  if (!w || w.archived) return fail("Wallet not found.");
  const diff = toMinor(a.data) - w.balance;
  if (diff === 0) return { ok: true, difference: 0 };
  await db.insert(walletTransfers).values({
    fromWalletId: diff < 0 ? walletId : null,
    toWalletId: diff > 0 ? walletId : null,
    amount: Math.abs(diff),
    date,
    note: "Balance adjustment",
  });
  return { ok: true, difference: diff };
}

// Removes a transfer (and its fee expense, if any).
export async function deleteTransfer(id: string): Promise<Result> {
  const [x] = await db.select().from(walletTransfers).where(eq(walletTransfers.id, id));
  if (!x) return fail("Transfer not found.");
  await db.batch([
    db.delete(walletTransfers).where(eq(walletTransfers.id, id)),
    ...(x.feeTransactionId ? [db.delete(transactions).where(eq(transactions.id, x.feeTransactionId))] : []),
  ]);
  return { ok: true };
}

// For transaction forms: a wallet must exist and (for new money) be active.
export async function checkWallet(walletId: string | null | undefined, allowArchived = false) {
  if (!walletId) return null;
  const [w] = await db.select({ archived: wallets.archived }).from(wallets).where(and(eq(wallets.id, walletId)));
  if (!w) return fail("Wallet not found.");
  if (w.archived && !allowArchived) return fail("That wallet is archived.");
  return null;
}
