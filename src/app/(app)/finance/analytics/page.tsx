import { ArrowDownRight, ArrowUpRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { CategoryDonut, TrendChart } from "@/components/Charts";
import { Notched } from "@/components/Notched";
import { RangeFilter } from "@/components/RangeFilter";
import { StatsBar } from "@/components/StatsBar";
import type { TransactionKind } from "@/db/schema";
import { analyticsRange, bucketLabels, RANGE_PRESETS } from "@/lib/analytics";
import { requireSession } from "@/lib/auth";
import { bucketTotals, categoryTotals, countsByKind, largestExpenses, monthlyTotals, summarize, type Summary } from "@/lib/core/finance";
import { lastMonths, today } from "@/lib/dates";
import { formatMoney, KIND_META } from "@/lib/money";

export const metadata = { title: "Analytics" };

type Params = { range?: string; from?: string; to?: string };

// Series colours, in the fixed order income, expenses, investments, donations.
const CHART: Record<TransactionKind, string> = {
  income: "var(--chart-income)",
  expense: "var(--chart-expense)",
  investment: "var(--chart-investment)",
  donation: "var(--chart-donation)",
};
const spentKey = { expense: "spentExpense", investment: "spentInvestment", donation: "spentDonation" } as const;
const amountOf = (s: Summary, k: TransactionKind) => (k === "income" ? s.income : s[spentKey[k]]);

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const s = await requireSession();
  const r = analyticsRange(await searchParams, today(), s.locale);
  const kinds: TransactionKind[] = ["income", "expense", ...(s.manageInvestment ? ["investment" as const] : []), ...(s.manageDonation ? ["donation" as const] : [])];
  const range = { from: r.from, to: r.to };

  const [cur, prev, counts, byBucket, cats, biggest, history] = await Promise.all([
    summarize(range),
    summarize(r.prev),
    countsByKind(range),
    bucketTotals(range, r.bucket),
    Promise.all(kinds.map((k) => categoryTotals(k, range))),
    largestExpenses(range),
    monthlyTotals(lastMonths(7).slice(0, 6)), // the 6 full months before this one
  ]);

  const money = { currency: s.currency, locale: s.locale, symbol: s.currencySymbol };
  const fmt = (m: number) => formatMoney(m, s.currency, s.locale, s.currencySymbol);
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
  const zero = { income: 0, spentExpense: 0, spentInvestment: 0, spentDonation: 0, savings: 0 };
  const rows = r.buckets.map((b) => ({ key: b, ...zero, ...byBucket.get(b) }));
  const labels = r.buckets.map((b) => bucketLabels(b, s.locale));
  const per = r.bucket === "day" ? "day" : "month";
  const spent = cur.spentExpense + cur.spentInvestment + cur.spentDonation;
  const empty = !cur.income && !spent;

  // Income against the usual: the average of the last 6 full months with
  // income, scaled to the length of this range.
  const earning = history.filter((h) => h.income > 0);
  const avgIncome = earning.length ? earning.reduce((a, h) => a + h.income, 0) / earning.length : 0;
  const expectedIncome = avgIncome * Math.max(1, Math.round(r.days / 30.44));

  const best = rows.reduce((a, b) => (b.savings > a.savings ? b : a), rows[0]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* header + range */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <AppIcon name="analytics" size={48} />
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold">Analytics</h1>
            <p className="mt-1 text-sm text-ink-3">{r.label} · compared with the {r.key === "month" ? "same days last month" : "period before"}</p>
          </div>
          <RangeFilter current={r.key} label={RANGE_PRESETS.find((p) => p.key === r.key)!.label} from={r.from} to={r.to} max={today()} />
        </div>
        <nav aria-label="Range" className="seg hidden max-w-full overflow-x-auto [scrollbar-width:none] lg:flex">
          {RANGE_PRESETS.map((p) => (
            <Link
              key={p.key}
              href={p.key === "custom" ? `?range=custom&from=${r.from}&to=${r.to}` : `?range=${p.key}`}
              aria-current={p.key === r.key ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1 font-medium ${p.key === r.key ? "bg-accent-strong text-white" : "text-ink-3 hover:text-ink"}`}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      </div>
      {r.key === "custom" && (
        <form className="card hidden flex-wrap items-end gap-3 py-4 lg:flex">
          <input type="hidden" name="range" value="custom" />
          <div>
            <label className="label" htmlFor="from">From</label>
            <input id="from" name="from" type="date" defaultValue={r.from} max={today()} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="to">To</label>
            <input id="to" name="to" type="date" defaultValue={r.to} max={today()} required className="input" />
          </div>
          <button className="btn btn-primary">Apply</button>
          <p className="text-xs text-ink-3 sm:ml-auto">Up to 3 years. Ranges over 2 months are shown by month.</p>
        </form>
      )}

      {/* one card per kind */}
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 ${kinds.length > 3 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        {kinds.map((k) => {
          const now = amountOf(cur, k), before = amountOf(prev, k);
          const delta = before > 0 ? ((now - before) / before) * 100 : null;
          const goodWhenUp = k !== "expense";
          const share = k === "income" ? pct(now, expectedIncome) : pct(now, cur.income);
          return (
            <Notched key={k} badge={<AppIcon name={KIND_META[k].icon as "income"} size={36} />} className="h-full border border-rule bg-surface p-4 sm:p-5">
              <div className="flex h-full flex-col gap-3">
                <p className="pr-10 text-[13px] text-ink-3">{KIND_META[k].plural}</p>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-2xl font-medium tracking-tight tabular-nums">{fmt(now)}</p>
                  {delta !== null && Math.round(delta) !== 0 && (
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${(delta > 0) === goodWhenUp ? "bg-income/12 text-income" : "bg-danger/10 text-danger"}`}
                      title={`${fmt(before)} in the previous period`}
                    >
                      {delta > 0 ? <ArrowUpRight size={11} weight="bold" /> : <ArrowDownRight size={11} weight="bold" />}
                      {Math.abs(Math.round(delta))}%
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-ink-3">
                    <span>{k === "income" ? (avgIncome ? `${share}% of your usual` : "No history yet") : `${share}% of income`}</span>
                    <span>{counts[k] ?? 0} transaction{counts[k] === 1 ? "" : "s"}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(share, 100)}%`, background: CHART[k] }} />
                  </div>
                </div>
                <p className="mt-auto flex justify-between border-t border-rule pt-2.5 text-xs text-ink-3">
                  {k === "income" ? (
                    <>Saved <b className={`font-medium tabular-nums ${cur.savings < 0 ? "text-danger" : "text-ink"}`}>{fmt(cur.savings)}</b></>
                  ) : (
                    <>Average a {per} <b className="font-medium tabular-nums text-ink">{fmt(Math.round(now / rows.length))}</b></>
                  )}
                </p>
              </div>
            </Notched>
          );
        })}
      </div>

      {empty ? (
        <p className="card py-12 text-center text-sm text-ink-3">No transactions in {r.label}.</p>
      ) : (
        <>
          {/* where income went */}
          {cur.income > 0 && (
            <section className="card space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">Where your income went</h2>
                <p className="text-sm text-ink-2">
                  {cur.savings >= 0 ? (
                    <>Kept <b className="font-medium text-ink">{pct(cur.savings, cur.income)}%</b> of {fmt(cur.income)}</>
                  ) : (
                    <>Spent <b className="font-medium text-danger">{fmt(-cur.savings)}</b> more than you earned</>
                  )}
                </p>
              </div>
              {(() => {
                const parts = [
                  ...kinds.filter((k) => k !== "income").map((k) => ({ key: k, label: KIND_META[k].plural, value: amountOf(cur, k), color: CHART[k] })),
                  { key: "saved", label: "Saved", value: Math.max(cur.savings, 0), color: "var(--chart-income)" },
                ].filter((p) => p.value > 0);
                const whole = Math.max(cur.income, spent);
                return (
                  <>
                    <div className="flex h-4 gap-[2px] overflow-hidden rounded-full bg-surface-2">
                      {parts.map((p) => (
                        <div
                          key={p.key}
                          title={`${p.label}: ${fmt(p.value)}`}
                          className="h-full first:rounded-l-full last:rounded-r-full"
                          style={{
                            width: `${(p.value / whole) * 100}%`,
                            background: p.key === "saved" ? `repeating-linear-gradient(135deg, ${p.color} 0 6px, color-mix(in oklab, ${p.color} 70%, var(--surface)) 6px 9px)` : p.color,
                          }}
                        />
                      ))}
                    </div>
                    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                      {parts.map((p) => (
                        <li key={p.key} className="flex items-center gap-1.5 text-ink-2">
                          <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} />
                          {p.label}
                          <b className="font-medium tabular-nums text-ink">{fmt(p.value)}</b>
                          <span className="tabular-nums text-ink-3">{pct(p.value, cur.income)}%</span>
                        </li>
                      ))}
                    </ul>
                  </>
                );
              })()}
            </section>
          )}

          {/* cash flow over time */}
          <section className="card">
            {/* By month: each month's amounts. By day the amounts are spiky
                (one salary day, many small spends), so show running totals. */}
            <TrendChart
              title={r.bucket === "day" ? "Running totals through the period" : "Money in and out, by month"}
              labels={labels}
              money={money}
              height={260}
              series={kinds.map((k) => {
                const values = rows.map((row) => (k === "income" ? row.income : row[spentKey[k]]));
                if (r.bucket === "day") for (let i = 1; i < values.length; i++) values[i] += values[i - 1];
                return { key: k, label: KIND_META[k].plural, color: CHART[k], values };
              })}
            />
            <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-rule pt-3 text-xs text-ink-3">
              <span>Average a {per}</span>
              {kinds.map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px]" style={{ background: CHART[k] }} />
                  {KIND_META[k].plural}
                  <b className="font-medium tabular-nums text-ink">{fmt(Math.round(amountOf(cur, k) / rows.length))}</b>
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                Saved
                <b className={`font-medium tabular-nums ${cur.savings < 0 ? "text-danger" : "text-ink"}`}>{fmt(Math.round(cur.savings / rows.length))}</b>
              </span>
            </p>
          </section>

          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <section className="card">
              <TrendChart
                title={`Income by ${per}`}
                variant="bars"
                labels={labels}
                money={money}
                height={200}
                average={Math.round(cur.income / rows.length)}
                series={[{ key: "income", label: "Income", color: CHART.income, values: rows.map((row) => row.income) }]}
              />
              <p className="mt-3 text-xs text-ink-3">Dashed line: your average a {per} in this range.</p>
            </section>
            <section className="card">
              <TrendChart
                title={`Spending by ${per}`}
                variant="bars"
                labels={labels}
                money={money}
                height={200}
                average={Math.round(cur.spentExpense / rows.length)}
                series={[{ key: "expense", label: "Expenses", color: CHART.expense, values: rows.map((row) => row.spentExpense) }]}
              />
              <p className="mt-3 text-xs text-ink-3">Dashed line: your average a {per} in this range.</p>
            </section>
          </div>

          {/* categories */}
          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            {/* expenses first: the breakdown people look for most */}
            {[...kinds].sort((a, b) => Number(b === "expense") - Number(a === "expense")).map((k) => (
              <section key={k} className="card">
                <CategoryDonut
                  title={k === "expense" ? "Where the money went" : `${KIND_META[k].plural} by category`}
                  empty={`No ${KIND_META[k].plural.toLowerCase()} in this range.`}
                  money={money}
                  items={cats[kinds.indexOf(k)].map((c) => ({ key: c.categoryId ?? "none", label: c.name ?? "No category", value: c.total, color: c.color ?? "var(--ink-3)", count: c.count }))}
                />
              </section>
            ))}
          </div>

          {/* biggest expenses */}
          <div className="grid gap-4 [&>*]:min-w-0">
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold">Biggest expenses</h2>
              {biggest.length ? (
                <ol className="space-y-1">
                  {biggest.map((t, i) => (
                    <li key={t.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-medium text-ink-2">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.description || t.categoryName || "Expense"}</p>
                        <p className="flex items-center gap-1.5 text-xs text-ink-3">
                          {t.categoryName && <span className="size-1.5 rounded-full" style={{ background: t.categoryColor ?? "var(--ink-3)" }} />}
                          {t.categoryName ?? "No category"} · {new Date(`${t.date}T12:00`).toLocaleDateString(s.locale, { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums">{fmt(t.amount)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-6 text-center text-sm text-ink-3">No expenses in this range.</p>
              )}
            </section>

          </div>
        </>
      )}

      <StatsBar
        note={r.label}
        items={[
          { label: "Savings rate", value: cur.income ? `${pct(cur.savings, cur.income)}%` : "—" },
          { label: `Avg. saved / ${per}`, value: fmt(Math.round(cur.savings / rows.length)) },
          { label: `Best ${per}`, value: best && best.savings > 0 ? labels[rows.indexOf(best)].short : "—" },
        ]}
      />
    </div>
  );
}
