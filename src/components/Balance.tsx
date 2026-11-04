// A wallet balance: shown as **** until revealed with BalanceToggle
// (<html data-show-balances>, see globals.css). Server-safe, no flash: the
// hidden state is the default.
export function Balance({ children }: { children: React.ReactNode }) {
  return (
    <span className="balance">
      <span className="balance-amount">{children}</span>
    </span>
  );
}
