import { MagnifyingGlass } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Settings, TransactionKind } from "@/db/schema";
import { countsByKind, listCategories, listTransactions, summarize } from "@/lib/core/finance";
import { walletOptions } from "@/lib/core/wallets";
import { monthRange, today } from "@/lib/dates";
import { formatMoney, KIND_META } from "@/lib/money";
import { AppIcon } from "./AppIcon";
import { Pagination } from "./Pagination";
import { QuickAdd } from "./QuickAdd";
import { StatsBar } from "./StatsBar";
import { TransactionForm } from "./TransactionForm";
import { TransactionList } from "./TransactionList";

export type ListParams = { page?: string; q?: string; cat?: string; wallet?: string };
const PER_PAGE = 20;

// One page per kind (income / expenses / investments / donations): every
// entry, newest first, 20 a page, with search and a category filter. The
// header and stats show this month and all time.
export async function TransactionsView({ kind, params, s }: { kind: TransactionKind; params: ListParams; s: Settings }) {
  const thisMonth = monthRange();
  const [cats, walletList] = await Promise.all([listCategories(kind), walletOptions()]);
  const q = params.q?.trim().slice(0, 100) || undefined;
  const cat = cats.some((c) => c.id === params.cat) ? params.cat : undefined;
  const wallet = walletList.some((w) => w.id === params.wallet) ? params.wallet : undefined;
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const [{ rows, total }, month, allTime, monthCounts] = await Promise.all([
    listTransactions({ kind, search: q, categoryId: cat, walletId: wallet, limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
    summarize({ from: thisMonth.from, to: thisMonth.to }),
    summarize(),
    countsByKind({ from: thisMonth.from, to: thisMonth.to }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (page > pages) redirect(`?${new URLSearchParams({ ...(q && { q }), ...(cat && { cat }), ...(wallet && { wallet }), ...(pages > 1 && { page: String(pages) }) })}`);

  const meta = KIND_META[kind];
  const pick = (x: Awaited<ReturnType<typeof summarize>>) => ({ income: x.income, expense: x.spentExpense, investment: x.spentInvestment, donation: x.spentDonation })[kind];
  const monthTotal = pick(month), allTotal = pick(allTime), monthN = monthCounts[kind] ?? 0;
  const fmt = (m: number) => formatMoney(m, s.currency, s.locale, s.currencySymbol);
  const plain = cats.map((c) => ({ id: c.id, name: c.name }));
  const filtered = !!(q || cat || wallet);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="hidden lg:block"><AppIcon name={meta.icon} size={48} /></span>
          <div>
            <h1 className="text-3xl font-semibold">{meta.plural}</h1>
            <p className="mt-1 text-sm text-ink-3">
              This month <b style={{ color: `var(--${kind})` }}>{fmt(monthTotal)}</b> · All time <b className="text-ink-2">{fmt(allTotal)}</b>
            </p>
          </div>
        </div>
      </div>
      {/* phones add through the + button (QuickAdd) instead */}
      <section className="card hidden md:block">
        <h2 className="mb-3 text-sm font-semibold">Add {meta.label.toLowerCase()}</h2>
        <TransactionForm kind={kind} categories={plain} currency={s.currencySymbol || s.currency} today={today()} />
      </section>
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{filtered ? `Matching entries · ${total}` : `All entries · ${total}`}</h2>
          {/* GET form: filtering starts again from page 1 */}
          <form role="search" className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
              <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
              <input name="q" type="search" defaultValue={q} placeholder="Search" aria-label={`Search ${meta.plural.toLowerCase()}`} className="input py-2 pl-9" />
            </div>
            {cats.length > 0 && (
              <select name="cat" defaultValue={cat ?? ""} aria-label="Category" className="input w-auto py-2">
                <option value="">All categories</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {walletList.length > 0 && (
              <select name="wallet" defaultValue={wallet ?? ""} aria-label="Wallet" className="input w-auto py-2">
                <option value="">All wallets</option>
                {walletList.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            )}
            <button className="btn btn-ghost py-2">Filter</button>
            {filtered && <Link href="?" className="text-sm text-accent-text hover:underline">Clear</Link>}
          </form>
        </div>
        {rows.length || !filtered ? (
          <TransactionList rows={rows} currency={s.currency} symbol={s.currencySymbol} locale={s.locale} today={today()} categories={{ [kind]: plain }} />
        ) : (
          <p className="py-8 text-center text-sm text-ink-3">No {meta.plural.toLowerCase()} match that.</p>
        )}
        <Pagination page={page} pages={pages} total={total} perPage={PER_PAGE} params={{ q, cat, wallet }} />
      </section>
      <QuickAdd kind={kind} kinds={[kind]} categories={{ [kind]: plain }} currency={s.currencySymbol || s.currency} today={today()} />
      <StatsBar
        note={thisMonth.label}
        items={[
          { label: "This month", value: fmt(monthTotal) },
          { label: "Entries", value: String(monthN) },
          { label: "Average", value: monthN ? fmt(Math.round(monthTotal / monthN)) : "—" },
          { label: "All time", value: fmt(allTotal) },
        ]}
      />
    </div>
  );
}
