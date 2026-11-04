import "server-only";
import { z } from "zod";
import { TRANSACTION_KINDS } from "@/db/schema";
import {
  createCategory, createTransaction, deleteCategory, deleteTransaction, expensesByCategory, listCategories, listTransactions, monthlyTotals, summarize,
  updateTransaction,
} from "@/lib/core/finance";
import { getSettings } from "@/lib/core/settings";
import { createTransfer, listWallets } from "@/lib/core/wallets";
import { lastMonths, today } from "@/lib/dates";
import { fromMinor } from "@/lib/money";
import { date, id, tool } from "./shared";

// Amounts are stored in minor units; tools speak in normal amounts.
const kind = z.enum(TRANSACTION_KINDS);
const totals = (r: { income: number; spentExpense: number; spentInvestment: number; spentDonation: number; savings: number }) => ({
  income: fromMinor(r.income),
  expenses: fromMinor(r.spentExpense),
  investments: fromMinor(r.spentInvestment),
  donations: fromMinor(r.spentDonation),
  savings: fromMinor(r.savings),
});

export const financeTools = [
  tool({
    name: "finance_summary",
    description: "Totals of income, expenses, investments and donations, and what's left (savings), for a date range or all time.",
    input: z.object({ from: date.optional(), to: date.optional() }),
    run: async (f) => {
      const [s, settings] = await Promise.all([summarize(f), getSettings()]);
      return { currency: settings?.currency, ...totals(s) };
    },
  }),
  tool({
    name: "monthly_totals",
    description: "Income, expenses, investments, donations and savings per month for the last N months (oldest first).",
    input: z.object({ months: z.number().int().min(1).max(36).default(6) }),
    run: async ({ months }) => (await monthlyTotals(lastMonths(months))).map((m) => ({ month: m.month, ...totals(m) })),
  }),
  tool({
    name: "spending_by_category",
    description: "Expenses grouped by category for a date range (all time when left out), largest first.",
    input: z.object({ from: date.optional(), to: date.optional() }),
    run: async (f) => (await expensesByCategory(f)).map((r) => ({ categoryId: r.categoryId, category: r.name ?? "Uncategorised", total: fromMinor(r.total) })),
  }),
  tool({
    name: "list_transactions",
    description: "List transactions, newest first.",
    input: z.object({
      kind: kind.optional(),
      from: date.optional(),
      to: date.optional(),
      search: z.string().optional().describe("Match in the description"),
      limit: z.number().int().min(1).max(200).default(50),
    }),
    run: async (f) => {
      const { rows, total } = await listTransactions(f);
      return { total, rows: rows.map(({ id, kind, date, amount, description, categoryId, categoryName }) => ({ id, kind, date, amount: fromMinor(amount), description, categoryId, category: categoryName })) };
    },
  }),
  tool({
    name: "list_finance_categories",
    description: "List finance categories; each belongs to one kind.",
    input: z.object({ kind: kind.optional() }),
    run: async ({ kind }) => (await listCategories(kind)).map(({ id, name, kind }) => ({ id, name, kind })),
  }),
  tool({
    name: "add_transaction",
    description: "Record income, an expense, an investment or a donation. The category must be of the same kind.",
    write: true,
    input: z.object({
      kind,
      amount: z.number().positive().describe("In the dashboard's currency, e.g. 12.5"),
      date: date.optional().describe("Defaults to today"),
      description: z.string().optional(),
      categoryId: id("Finance category").optional(),
      walletId: id("Wallet").optional().describe("Which wallet the money comes from (income: goes into). Defaults to the default wallet; see list_wallets"),
    }),
    run: async (t) => {
      const walletId = t.walletId ?? (await listWallets({ archived: false })).find((w) => w.isDefault)?.id;
      return createTransaction({ ...t, walletId, date: t.date ?? today() });
    },
  }),
  tool({
    name: "update_transaction",
    description: "Edit a transaction's date, amount, description or category. Fields left out are unchanged; an empty description or null category clears it.",
    write: true,
    input: z.object({
      id: id("Transaction"),
      amount: z.number().positive().optional(),
      date: date.optional(),
      description: z.string().optional(),
      categoryId: id("Finance category").nullable().optional(),
      walletId: id("Wallet").nullable().optional(),
    }),
    run: async ({ id, ...patch }) => {
      const r = await updateTransaction(id, patch);
      return r.ok ? { ok: true } : r;
    },
  }),
  tool({
    name: "delete_transaction",
    description: "Permanently delete a transaction.",
    write: true,
    input: z.object({ id: id("Transaction") }),
    run: async ({ id }) => {
      const r = await deleteTransaction(id);
      return r.ok ? { ok: true } : r;
    },
  }),
  tool({
    name: "create_finance_category",
    description: "Create a finance category for one kind (income, expense, investment or donation).",
    write: true,
    input: z.object({ name: z.string(), kind, color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }),
    run: (args) => createCategory(args),
  }),
  tool({
    name: "delete_finance_category",
    description: "Delete a finance category. Its transactions are kept and become uncategorised.",
    write: true,
    input: z.object({ id: id("Finance category") }),
    run: ({ id }) => deleteCategory(id),
  }),
  tool({
    name: "list_wallets",
    description: "Wallets (bank accounts, cash, mobile wallets…) with their current balance and this month's money in and out.",
    input: z.object({ includeArchived: z.boolean().default(false) }),
    run: async ({ includeArchived }) =>
      (await listWallets({ archived: includeArchived ? undefined : false, monthFrom: `${today().slice(0, 7)}-01` })).map((w) => ({
        id: w.id, name: w.name, type: w.type, isDefault: w.isDefault, archived: w.archived,
        balance: fromMinor(w.balance), inThisMonth: fromMinor(w.monthIn), outThisMonth: fromMinor(w.monthOut),
      })),
  }),
  tool({
    name: "transfer_between_wallets",
    description: "Move money from one wallet to another (e.g. ATM withdrawal: bank → cash). An optional fee is recorded as an expense from the source wallet. Not income or spending.",
    write: true,
    input: z.object({
      fromWalletId: id("Wallet to take from"),
      toWalletId: id("Wallet to put into"),
      amount: z.number().positive(),
      fee: z.number().min(0).optional(),
      date: date.optional().describe("Defaults to today"),
      note: z.string().optional(),
    }),
    run: (t) => createTransfer({ ...t, date: t.date ?? today() }),
  }),
];
