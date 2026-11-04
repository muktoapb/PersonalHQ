import type { Settings } from "@/db/schema";
import type { Summary } from "@/lib/core/finance";
import { formatMoney } from "@/lib/money";
import { StatCard } from "./StatCard";

// This period's flow.
export function FinanceSummary({ period, s }: { period: Summary; s: Settings }) {
  const fmt = (m: number) => formatMoney(m, s.currency, s.locale, s.currencySymbol);
  const rate = (x: Summary) => (x.income ? `${Math.round((x.savings / x.income) * 100)}% of income` : undefined);
  return (
    <div className="space-y-6">
      <section>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard icon="income" label="Income" value={fmt(period.income)} color="var(--income)" />
          <StatCard icon="expense" label="Expenses" value={fmt(period.spentExpense)} color="var(--expense)" />
          {(s.manageInvestment || s.manageDonation) && (
            <StatCard icon="donation" label="Invested + donated" value={fmt(period.spentInvestment + period.spentDonation)} />
          )}
          <StatCard icon="savings" label="Savings" value={fmt(period.savings)} hint={rate(period)} />
        </div>
      </section>
    </div>
  );
}
