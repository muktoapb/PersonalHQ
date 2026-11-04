import { Star } from "@phosphor-icons/react/ssr";
import { notFound, redirect } from "next/navigation";
import { AppIcon } from "@/components/AppIcon";
import { Balance } from "@/components/Balance";
import { BalanceToggle } from "@/components/BalanceToggle";
import { Pagination } from "@/components/Pagination";
import { StatsBar } from "@/components/StatsBar";
import { AdjustBalance, DeleteTransfer, TransferDialog, WalletArchiveButtons, WalletDialog } from "@/components/Wallets";
import type { TransactionKind } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { getWallet, walletHistory, walletOptions } from "@/lib/core/wallets";
import { monthRange, today } from "@/lib/dates";
import { formatMoney, KIND_META } from "@/lib/money";
import { WALLET_TYPE_META } from "@/lib/wallets";

type Props = { params: Promise<{ walletId: string }>; searchParams: Promise<{ page?: string }> };
const PER_PAGE = 20;

export async function generateMetadata({ params }: Props) {
  return { title: (await getWallet((await params).walletId))?.name ?? "Wallet" };
}

// One wallet: its balance, what it held at the start, and every entry and
// transfer through it.
export default async function WalletPage({ params, searchParams }: Props) {
  const s = await requireSession();
  const { walletId } = await params;
  const page = Math.max(1, Math.floor(Number((await searchParams).page)) || 1);
  const month = monthRange();
  const [w, history, options] = await Promise.all([getWallet(walletId), walletHistory(walletId, PER_PAGE, (page - 1) * PER_PAGE), walletOptions()]);
  if (!w) notFound();
  const pages = Math.max(1, Math.ceil(history.total / PER_PAGE));
  if (page > pages) redirect(pages > 1 ? `?page=${pages}` : "?");
  const fmt = (m: number) => formatMoney(m, s.currency, s.locale, s.currencySymbol);
  const name = new Map(options.map((o) => [o.id, o.name]));
  const meta = WALLET_TYPE_META[w.type];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-0 sm:flex-1">
          <AppIcon name={meta.icon} size={52} color={w.color} />
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-3xl font-semibold">
              {w.name}
              {w.isDefault && <Star size={18} weight="fill" className="shrink-0 text-accent-text" aria-label="Default wallet" />}
            </h1>
            <p className="text-sm text-ink-3">{meta.label}{w.archived ? " · archived" : w.isDefault ? " · default for new entries" : ""}</p>
          </div>
        </div>
        {!w.archived && <TransferDialog wallets={options} currency={s.currencySymbol || s.currency} today={today()} from={w.id} />}
        <WalletDialog trigger="edit" currency={s.currencySymbol || s.currency} wallet={w} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
        <section className="card">
          <p className="flex items-center gap-1 text-sm text-ink-3">Balance <BalanceToggle className="-my-2 hover:bg-surface-2 hover:text-ink" /></p>
          <p className={`mt-1 text-4xl font-medium tracking-tight tabular-nums ${w.balance < 0 ? "text-danger" : ""}`}><Balance>{fmt(w.balance)}</Balance></p>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-rule pt-3 text-xs text-ink-3">
            <p>In this month<b className="block text-sm font-medium text-income">{fmt(w.monthIn)}</b></p>
            <p>Out this month<b className="block text-sm font-medium text-ink">{fmt(w.monthOut)}</b></p>
          </div>
        </section>
        <section className="card space-y-3">
          {w.archived ? (
            <p className="text-sm text-ink-2">Archived wallets keep their history but don&apos;t appear when you add entries.</p>
          ) : (
            <>
              <p className="text-sm text-ink-2">Doesn&apos;t match your bank or wallet? Enter what it really holds.</p>
              <AdjustBalance walletId={w.id} balance={w.balance} currency={s.currencySymbol || s.currency} />
            </>
          )}
          <div className="border-t border-rule pt-3">
            <WalletArchiveButtons id={w.id} archived={w.archived} canDelete={history.total === 0} />
          </div>
        </section>
      </div>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold">History · {history.total}</h2>
        {history.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-3">Nothing yet. Pick this wallet when you add income or an expense.</p>
        ) : (
          <ul className="space-y-2">
            {history.rows.map((r) => {
              if (r.type === "transfer") {
                const other = r.otherWalletId ? name.get(r.otherWalletId) : null;
                const label = other ? (r.kind === "in" ? `From ${other}` : `To ${other}`) : "Balance adjustment";
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-rule px-3 py-2.5">
                    <AppIcon name={other ? "transfer" : "adjust"} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{label}</p>
                      <p className="text-xs text-ink-3">{r.date}{r.description && r.description !== "Balance adjustment" ? ` · ${r.description}` : ""} · transfer</p>
                    </div>
                    <span className={`font-medium tabular-nums ${r.kind === "in" ? "text-income" : ""}`}>{r.kind === "in" ? "+" : "−"}{fmt(r.amount)}</span>
                    <DeleteTransfer id={r.id} label={label} />
                  </li>
                );
              }
              const kind = r.kind as TransactionKind;
              return (
                <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-rule px-3 py-2.5">
                  <AppIcon name={KIND_META[kind].icon} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.description || r.categoryName || KIND_META[kind].label}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                      {r.date}
                      {r.categoryName && <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: r.categoryColor ?? undefined }} />{r.categoryName}</span>}
                      <span>{KIND_META[kind].label}</span>
                    </p>
                  </div>
                  <span className="font-medium tabular-nums" style={{ color: `var(--${kind})` }}>{kind === "income" ? "+" : "−"}{fmt(r.amount)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination page={page} pages={pages} total={history.total} perPage={PER_PAGE} />
        <p className="border-t border-rule pt-3 text-xs text-ink-3">Starting balance <Balance>{fmt(w.openingBalance)}</Balance>. Edit or delete income and expenses from their own pages.</p>
      </section>

      <StatsBar
        note={month.label}
        items={[
          { label: "Balance", value: fmt(w.balance), private: true },
          { label: "In", value: fmt(w.monthIn) },
          { label: "Out", value: fmt(w.monthOut) },
          { label: "Entries", value: String(history.total) },
        ]}
      />
    </div>
  );
}
