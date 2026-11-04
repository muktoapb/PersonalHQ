// Client-safe money helpers. Amounts are stored as integer minor units (cents).

export const toMinor = (major: number) => Math.round(major * 100);
export const fromMinor = (minor: number) => minor / 100;

// `symbol` (Settings › Finance) replaces the currency code, e.g. "৳1,250.00"
// instead of "BDT 1,250.00"; number grouping still follows the locale.
export function formatMoney(minor: number, currency: string, locale = "en-US", symbol?: string | null, opts: Intl.NumberFormatOptions = {}) {
  try {
    const nf = new Intl.NumberFormat(locale, { style: "currency", currency, ...(symbol && { currencyDisplay: "narrowSymbol" }), ...opts });
    if (!symbol) return nf.format(fromMinor(minor));
    return nf
      .formatToParts(fromMinor(minor))
      .map((part) => (part.type === "currency" ? symbol : part.value))
      .join("");
  } catch {
    return `${symbol ?? ""}${fromMinor(minor).toFixed(2)}${symbol ? "" : ` ${currency}`}`;
  }
}

export const KIND_META = {
  income: { label: "Income", plural: "Income", icon: "income", slug: "income", color: "#10b981" },
  expense: { label: "Expense", plural: "Expenses", icon: "expense", slug: "expenses", color: "#f43f5e" },
  investment: { label: "Investment", plural: "Investments", icon: "investment", slug: "investments", color: "#0ea5e9" },
  donation: { label: "Donation", plural: "Donations", icon: "donation", slug: "donations", color: "#8b5cf6" },
} as const;
