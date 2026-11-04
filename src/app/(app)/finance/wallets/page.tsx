import { ArrowRight, Star } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { Balance } from "@/components/Balance";
import { BalanceToggle } from "@/components/BalanceToggle";
import { StatsBar } from "@/components/StatsBar";
import { DeleteTransfer, TransferDialog, WalletDialog } from "@/components/Wallets";
import { requireSession } from "@/lib/auth";
import { listWallets, recentTransfers } from "@/lib/core/wallets";
import { monthRange, today } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { WALLET_TYPE_META } from "@/lib/wallets";

export const metadata = { title: "Wallets" };

export default async function WalletsPage() {
  const s = await requireSession();
  const month = monthRange();
  const [all, transfers] = await Promise.all([listWallets({ monthFrom: month.from }), recentTransfers(8)]);
  const active = all.filter((w) => !w.archived);
  const archived = all.filter((w) => w.archived);
  const total = active.reduce((a, w) => a + w.balance, 0);
  const fmt = (m: number) => formatMoney(m, s.currency, s.locale, s.currencySymbol);
  const name = new Map(all.map((w) => [w.id, w.name]));
  const options = all.map(({ id, name, type, color, isDefault, archived }) => ({ id, name, type, color, isDefault, archived }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <AppIcon name="wallets" size={48} />
          <div>
            <h1 className="text-3xl font-semibold">Wallets</h1>
            <p className="mt-1 text-sm text-ink-3">Bank accounts, cash and mobile wallets — and what&apos;s in each.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <TransferDialog wallets={options} currency={s.currencySymbol || s.currency} today={today()} />
          {active.length > 0 && <WalletDialog trigger="button" currency={s.currencySymbol || s.currency} />}
        </div>
      </div>

      {active.length > 0 && (
        <section className="hero flex flex-wrap items-end justify-between gap-4 py-7">
          <div>
            <p className="flex items-center gap-1 text-sm text-white/75">
              Total balance · {active.length} wallet{active.length === 1 ? "" : "s"}
              <BalanceToggle className="-my-2 text-white/80 hover:bg-white/15 hover:text-white" />
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl"><Balance>{fmt(total)}</Balance></p>
          </div>
          {/* how the total splits across wallets */}
          {total > 0 && active.length > 1 && (
            <div className="w-full max-w-sm space-y-2">
              <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-white/15">
                {active.filter((w) => w.balance > 0).map((w) => (
                  <div key={w.id} title={`${w.name}: ${Math.round((w.balance / total) * 100)}%`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(w.balance / total) * 100}%`, background: w.color }} />
                ))}
              </div>
              <p className="text-xs text-white/75">{active.filter((w) => w.balance > 0).map((w) => `${w.name} ${Math.round((w.balance / total) * 100)}%`).join(" · ")}</p>
            </div>
          )}
        </section>
      )}

      {active.length === 0 ? (
        <section className="card flex flex-col items-center gap-4 py-12 text-center">
          <AppIcon name="wallets" size={56} />
          <div>
            <h2 className="text-lg font-semibold">Add your first wallet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
              Add each bank account, your cash and mobile wallets with what&apos;s in them now. Then pick a wallet when you add income or an expense, and balances keep themselves up to date.
            </p>
          </div>
          <WalletDialog trigger="button" currency={s.currencySymbol || s.currency} />
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((w) => (
            <Link key={w.id} href={`/finance/wallets/${w.id}`} className="card group flex flex-col gap-4 transition hover:border-accent/40">
              <div className="flex items-center gap-3">
                <AppIcon name={WALLET_TYPE_META[w.type].icon} size={40} color={w.color} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {w.name}
                    {w.isDefault && <Star size={13} weight="fill" className="shrink-0 text-accent-text" aria-label="Default wallet" />}
                  </p>
                  <p className="text-xs text-ink-3">{WALLET_TYPE_META[w.type].label}</p>
                </div>
                <ArrowRight size={16} className="text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-accent-text" />
              </div>
              <p className={`text-2xl font-medium tracking-tight tabular-nums ${w.balance < 0 ? "text-danger" : ""}`}><Balance>{fmt(w.balance)}</Balance></p>
              <div className="flex justify-between border-t border-rule pt-3 text-xs text-ink-3">
                <span>In this month <b className="font-medium text-income">{fmt(w.monthIn)}</b></span>
                <span>Out <b className="font-medium text-ink">{fmt(w.monthOut)}</b></span>
              </div>
            </Link>
          ))}
          <WalletDialog trigger="card" currency={s.currencySymbol || s.currency} />
        </div>
      )}

      {transfers.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Recent transfers</h2>
          <ul className="space-y-1">
            {transfers.map((t) => {
              const label = t.fromWalletId && t.toWalletId ? `${name.get(t.fromWalletId)} → ${name.get(t.toWalletId)}` : `${name.get((t.toWalletId ?? t.fromWalletId)!)} · balance adjustment`;
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                  <AppIcon name={t.fromWalletId && t.toWalletId ? "transfer" : "adjust"} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{label}</p>
                    <p className="text-xs text-ink-3">{t.date}{t.note && t.note !== "Balance adjustment" ? ` · ${t.note}` : ""}{t.feeTransactionId ? " · with fee" : ""}</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{!t.fromWalletId ? "+" : !t.toWalletId ? "−" : ""}{fmt(t.amount)}</span>
                  <DeleteTransfer id={t.id} label={label} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {archived.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold">Archived · {archived.length}</summary>
          <ul className="mt-3 space-y-1">
            {archived.map((w) => (
              <li key={w.id}>
                <Link href={`/finance/wallets/${w.id}`} className="flex items-center gap-3 rounded-xl px-1 py-2 hover:bg-surface-2">
                  <AppIcon name={WALLET_TYPE_META[w.type].icon} size={32} color={w.color} />
                  <span className="flex-1 text-sm">{w.name}</span>
                  <span className="text-sm tabular-nums text-ink-3"><Balance>{fmt(w.balance)}</Balance></span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <StatsBar
        note={month.label}
        items={[
          { label: "Total balance", value: fmt(total), private: true },
          { label: "In this month", value: fmt(active.reduce((a, w) => a + w.monthIn, 0)) },
          { label: "Out this month", value: fmt(active.reduce((a, w) => a + w.monthOut, 0)) },
        ]}
      />
    </div>
  );
}
