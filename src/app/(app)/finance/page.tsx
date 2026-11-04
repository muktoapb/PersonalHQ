import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { FinanceSummary } from "@/components/FinanceSummary";
import { MenuList } from "@/components/MenuList";
import { TransactionList } from "@/components/TransactionList";
import { QuickAdd } from "@/components/QuickAdd";
import { StatsBar } from "@/components/StatsBar";
import { requireSession } from "@/lib/auth";
import { listCategories, listTransactions, summarize } from "@/lib/core/finance";
import { listWallets } from "@/lib/core/wallets";
import { WALLET_TYPE_META } from "@/lib/wallets";
import { monthRange, today } from "@/lib/dates";
import { formatMoney, KIND_META } from "@/lib/money";
import { financePages } from "@/lib/nav";

export const metadata = { title: "Finance" };

export default async function FinancePage() {
  const s = await requireSession();
  const r = monthRange();
  const [period, recent, cats, walletRows] = await Promise.all([
    summarize({ from: r.from, to: r.to }),
    listTransactions({ limit: 10 }),
    listCategories(),
    listWallets({ archived: false }),
  ]);
  const walletTotal = walletRows.length ? walletRows.reduce((a, w) => a + w.balance, 0) : null;
  const byKind: Record<string, { id: string; name: string }[]> = {};
  for (const c of cats) (byKind[c.kind] ??= []).push({ id: c.id, name: c.name });
  const addKinds = financePages(s).flatMap((p) => ("kind" in p ? [p.kind] : []));
  const kindTotal = { income: period.income, expense: period.spentExpense, investment: period.spentInvestment, donation: period.spentDonation };
  const kinds = [KIND_META.income, KIND_META.expense, ...(s.manageInvestment ? [KIND_META.investment] : []), ...(s.manageDonation ? [KIND_META.donation] : [])];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Finance</h1>
        <div className="hidden flex-wrap gap-2 md:flex">
          {kinds.map((k) => (
            <Link key={k.slug} href={`/finance/${k.slug}`} className="btn btn-ghost py-1.5 pl-1.5"><AppIcon name={k.icon} size={26} /> Add {k.label.toLowerCase()}</Link>
          ))}
        </div>
      </div>
      <FinanceSummary period={period} periodLabel={r.label} s={s} />
      {/* desktop: balances at a glance (phones get the Wallets row below) */}
      {walletRows.length > 0 && (
        <section className="card hidden lg:block">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Wallets <span className="font-normal text-ink-3">· {formatMoney(walletTotal ?? 0, s.currency, s.locale, s.currencySymbol)} in total</span></h2>
            <Link href="/finance/wallets" className="text-sm text-ink-3 hover:text-accent-text">All wallets →</Link>
          </div>
          <ul className="flex flex-wrap gap-2">
            {walletRows.map((w) => (
              <li key={w.id}>
                <Link href={`/finance/wallets/${w.id}`} className="flex items-center gap-2.5 rounded-2xl border border-rule py-2 pl-2 pr-4 transition hover:border-accent/40">
                  <AppIcon name={WALLET_TYPE_META[w.type].icon} size={32} color={w.color} />
                  <span>
                    <span className="block text-xs text-ink-3">{w.name}</span>
                    <span className={`block text-sm font-medium tabular-nums ${w.balance < 0 ? "text-danger" : ""}`}>{formatMoney(w.balance, s.currency, s.locale, s.currencySymbol)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* phones and tablets: the way into each kind and analytics (desktop: side panel) */}
      <MenuList
        className="lg:hidden"
        items={financePages(s)
          .filter((p) => p.href !== "/finance")
          .map((p) => ({
            ...p,
            value: "kind" in p ? formatMoney(kindTotal[p.kind], s.currency, s.locale, s.currencySymbol) : p.href === "/finance/wallets" && walletTotal !== null ? formatMoney(walletTotal, s.currency, s.locale, s.currencySymbol) : undefined,
            hint: "kind" in p ? r.label : p.href === "/finance/wallets" ? (walletTotal === null ? "Bank, cash, bKash…" : "Total balance") : "Charts and trends",
          }))}
      />
      <section className="card">
        <h2 className="mb-2 text-sm font-semibold">Recent</h2>
        <TransactionList rows={recent.rows} currency={s.currency} symbol={s.currencySymbol} locale={s.locale} today={today()} categories={byKind} showKind />
      </section>
      <QuickAdd kinds={addKinds} categories={byKind} currency={s.currencySymbol || s.currency} today={today()} />
      <StatsBar
        note={r.label}
        items={[
          { label: "Spent", value: formatMoney(period.spentExpense + period.spentInvestment + period.spentDonation, s.currency, s.locale, s.currencySymbol) },
          { label: "Saved", value: formatMoney(period.savings, s.currency, s.locale, s.currencySymbol) },
          { label: "Savings rate", value: period.income ? `${Math.round((period.savings / period.income) * 100)}%` : "—" },
        ]}
      />
    </div>
  );
}
