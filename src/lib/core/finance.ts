import "server-only";
import { and, asc, count, desc, eq, gte, like, lte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, TRANSACTION_KINDS, type TransactionKind, transactions, wallets } from "@/db/schema";
import { toMinor } from "@/lib/money";
import { type Result, fail } from "./result";
import { checkWallet } from "./wallets";

// Finance rule: savings = income - everything spent (expenses, investments, donations).

const kind = z.enum(TRANSACTION_KINDS);
const ymd = z.iso.date();
const amount = z.coerce.number().positive("Amount must be more than 0.").max(1_000_000_000);

export const transactionSchema = z.object({
  kind,
  date: ymd,
  amount,
  // "" clears; left out stays undefined, so a partial update doesn't clear it.
  description: z.string().trim().max(500).optional().transform((v) => (v === undefined ? undefined : v || null)),
  categoryId: z.uuid().nullable().optional().transform((v) => (v === undefined ? undefined : v || null)),
  walletId: z.string().nullable().optional().transform((v) => (v === undefined ? undefined : v || null)),
});

export const transactionPatchSchema = transactionSchema.omit({ kind: true }).partial();

async function checkCategory(categoryId: string | null | undefined, k: TransactionKind) {
  if (!categoryId) return null;
  const [c] = await db.select({ kind: categories.kind }).from(categories).where(eq(categories.id, categoryId));
  if (!c) return fail("Category not found.");
  if (c.kind !== k) return fail(`That category is for ${c.kind}, not ${k}.`);
  return null;
}

export async function createTransaction(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const t = parsed.data;
  const bad = (await checkCategory(t.categoryId, t.kind)) ?? (await checkWallet(t.walletId));
  if (bad) return bad;

  const [row] = await db
    .insert(transactions)
    .values({ ...t, amount: toMinor(t.amount) })
    .returning({ id: transactions.id });
  return { ok: true, id: row.id };
}

export async function updateTransaction(id: string, input: unknown): Promise<Result<{ id: string }>> {
  const parsed = transactionPatchSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const [cur] = await db.select().from(transactions).where(eq(transactions.id, id));
  if (!cur) return fail("Transaction not found.");
  const p = parsed.data;
  // Keeping an entry in a wallet that has since been archived is fine.
  const bad = (await checkCategory(p.categoryId, cur.kind)) ?? (await checkWallet(p.walletId, p.walletId === cur.walletId));
  if (bad) return bad;

  const patch: Partial<typeof transactions.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (p.date !== undefined) patch.date = p.date;
  if (p.description !== undefined) patch.description = p.description;
  if (p.categoryId !== undefined) patch.categoryId = p.categoryId;
  if (p.walletId !== undefined) patch.walletId = p.walletId;
  if (p.amount !== undefined) patch.amount = toMinor(p.amount);
  await db.update(transactions).set(patch).where(eq(transactions.id, id));
  return { ok: true, id };
}

export async function deleteTransaction(id: string): Promise<Result<{ deleted: typeof transactions.$inferSelect }>> {
  const [row] = await db.delete(transactions).where(eq(transactions.id, id)).returning();
  return row ? { ok: true, deleted: row } : fail("Transaction not found.");
}

export type TransactionFilter = {
  kind?: TransactionKind;
  from?: string;
  to?: string;
  categoryId?: string;
  walletId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

function where(f: TransactionFilter): SQL | undefined {
  const c: SQL[] = [];
  if (f.kind) c.push(eq(transactions.kind, f.kind));
  if (f.from) c.push(gte(transactions.date, f.from));
  if (f.to) c.push(lte(transactions.date, f.to));
  if (f.categoryId) c.push(eq(transactions.categoryId, f.categoryId));
  if (f.walletId) c.push(eq(transactions.walletId, f.walletId));
  if (f.search) c.push(like(transactions.description, `%${f.search.replace(/[%_]/g, "")}%`));
  return c.length ? and(...c) : undefined;
}

export async function listTransactions(f: TransactionFilter = {}) {
  const w = where(f);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: transactions.id,
        kind: transactions.kind,
        date: transactions.date,
        amount: transactions.amount,
        description: transactions.description,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        walletId: transactions.walletId,
        walletName: wallets.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(wallets, eq(transactions.walletId, wallets.id))
      .where(w)
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(f.limit ?? 50)
      .offset(f.offset ?? 0),
    db.select({ total: count() }).from(transactions).where(w),
  ]);
  return { rows, total };
}
export type TransactionRow = Awaited<ReturnType<typeof listTransactions>>["rows"][number];

const sumWhen = (k: TransactionKind) =>
  sql<number>`coalesce(sum(case when ${transactions.kind} = ${k} then ${transactions.amount} end), 0)`;
const kindTotals = {
  income: sumWhen("income"),
  spentExpense: sumWhen("expense"),
  spentInvestment: sumWhen("investment"),
  spentDonation: sumWhen("donation"),
};
const withSavings = <T extends { income: number; spentExpense: number; spentInvestment: number; spentDonation: number }>(r: T) => ({
  ...r,
  savings: r.income - r.spentExpense - r.spentInvestment - r.spentDonation,
});

// Totals for a date range (all time when from/to are omitted), in minor units.
export async function summarize(f: Pick<TransactionFilter, "from" | "to"> = {}) {
  const [r] = await db.select(kindTotals).from(transactions).where(where(f));
  return withSavings(r);
}
export type Summary = Awaited<ReturnType<typeof summarize>>;

// Per-month totals for the given "YYYY-MM" months (ascending); empty months are zero.
export async function monthlyTotals(months: string[]) {
  const month = sql<string>`substr(${transactions.date}, 1, 7)`;
  const rows = await db
    .select({ month, ...kindTotals })
    .from(transactions)
    .where(where({ from: `${months[0]}-01`, to: `${months[months.length - 1]}-31` }))
    .groupBy(month);
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return months.map((m) =>
    withSavings({ income: 0, spentExpense: 0, spentInvestment: 0, spentDonation: 0, ...byMonth.get(m), month: m }),
  );
}

// One kind's totals by category for a date range, largest first.
export async function categoryTotals(k: TransactionKind, f: Pick<TransactionFilter, "from" | "to">) {
  return db
    .select({
      categoryId: transactions.categoryId,
      name: categories.name,
      color: categories.color,
      total: sql<number>`sum(${transactions.amount})`,
      count: count(),
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(where({ ...f, kind: k }))
    .groupBy(transactions.categoryId)
    .orderBy(desc(sql`sum(${transactions.amount})`));
}
export const expensesByCategory = (f: Pick<TransactionFilter, "from" | "to">) => categoryTotals("expense", f);

// Totals per day ("YYYY-MM-DD") or per month ("YYYY-MM") in a range, only
// for buckets that have transactions (callers fill the gaps).
export async function bucketTotals(f: { from: string; to: string }, bucket: "day" | "month") {
  const key = bucket === "day" ? sql<string>`${transactions.date}` : sql<string>`substr(${transactions.date}, 1, 7)`;
  const rows = await db.select({ key, ...kindTotals }).from(transactions).where(where(f)).groupBy(key);
  return new Map(rows.map((r) => [r.key, withSavings(r)]));
}

// How many transactions of each kind in a range.
export async function countsByKind(f: Pick<TransactionFilter, "from" | "to">) {
  const rows = await db.select({ kind: transactions.kind, n: count() }).from(transactions).where(where(f)).groupBy(transactions.kind);
  return Object.fromEntries(rows.map((r) => [r.kind, r.n])) as Partial<Record<TransactionKind, number>>;
}

// The biggest single expenses in a range.
export const largestExpenses = (f: Pick<TransactionFilter, "from" | "to">, limit = 5) =>
  db
    .select({ id: transactions.id, date: transactions.date, amount: transactions.amount, description: transactions.description, categoryName: categories.name, categoryColor: categories.color })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(where({ ...f, kind: "expense" }))
    .orderBy(desc(transactions.amount))
    .limit(limit);

// ---------- categories ----------

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name required.").max(60),
  kind,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
});

export const listCategories = (k?: TransactionKind) =>
  db
    .select()
    .from(categories)
    .where(k ? eq(categories.kind, k) : undefined)
    .orderBy(asc(categories.kind), asc(categories.name));

export async function createCategory(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const [row] = await db.insert(categories).values(parsed.data).returning({ id: categories.id });
  return { ok: true, id: row.id };
}

// Transactions keep their amounts; their category becomes empty. Done
// explicitly because SQLite only honours ON DELETE SET NULL with foreign_keys on.
export async function deleteCategory(id: string): Promise<Result> {
  await db.update(transactions).set({ categoryId: null }).where(eq(transactions.categoryId, id));
  const res = await db.delete(categories).where(eq(categories.id, id));
  return res.rowsAffected ? { ok: true } : fail("Category not found.");
}
