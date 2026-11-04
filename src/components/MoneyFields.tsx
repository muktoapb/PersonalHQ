"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";

const CURRENCIES = ["USD", "EUR", "GBP", "BDT", "MYR", "SGD", "INR", "AED", "SAR", "CAD", "AUD", "JPY"];
const LOCALES = [
  ["en-US", "English (US) — 1,234.56"],
  ["en-GB", "English (UK) — 1,234.56"],
  ["en-IN", "English (India) — 1,23,456.78"],
  ["bn-BD", "বাংলা — ১,২৩৪.৫৬"],
  ["ms-MY", "Bahasa Melayu — 1,234.56"],
  ["de-DE", "Deutsch — 1.234,56"],
];

type Defaults = {
  currency?: string;
  currencySymbol?: string | null;
  locale?: string;
  manageDonation?: boolean;
  manageInvestment?: boolean;
};

// The usual symbol for a currency code ("৳" for BDT), or "" if there's none.
function standardSymbol(code: string, locale: string) {
  try {
    const sym = new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(1)
      .find((p) => p.type === "currency")?.value;
    return sym && sym.toUpperCase() !== code.toUpperCase() ? sym : "";
  } catch {
    return "";
  }
}

// Currency (code + optional symbol), number format and which money kinds to
// track; shared by setup and settings. Shows a live preview of an amount.
export function MoneyFields({ d = {} }: { d?: Defaults }) {
  const [code, setCode] = useState(d.currency ?? "USD");
  // A brand-new setup (no saved values) starts as US dollars with "$".
  const [symbol, setSymbol] = useState(d.currencySymbol ?? (d.currency === undefined ? "$" : ""));
  const [locale, setLocale] = useState(d.locale ?? "en-US");
  const suggested = /^[A-Za-z]{3}$/.test(code) ? standardSymbol(code.toUpperCase(), locale) : "";
  const valid = /^[A-Za-z]{3}$/.test(code);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1.4fr]">
        <div>
          <label className="label" htmlFor="currency">Currency</label>
          <input id="currency" name="currency" list="currencies" required maxLength={3} value={code} onChange={(e) => setCode(e.target.value)} className="input uppercase" />
          <datalist id="currencies">
            {CURRENCIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="currencySymbol">Symbol <span className="font-normal">(optional)</span></label>
          <input
            id="currencySymbol" name="currencySymbol" maxLength={4} value={symbol} onChange={(e) => setSymbol(e.target.value)}
            placeholder={suggested || "e.g. $"} className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="locale">Number format</label>
          <select id="locale" name="locale" value={locale} onChange={(e) => setLocale(e.target.value)} className="input">
            {LOCALES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <p className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
        <span>
          Amounts look like <b className="font-medium text-ink">{valid ? formatMoney(125050, code.toUpperCase(), locale, symbol.trim() || null) : "—"}</b>
        </span>
        {suggested && symbol.trim() !== suggested && (
          <button type="button" onClick={() => setSymbol(suggested)} className="rounded-full border border-rule px-2 py-0.5 text-accent-text hover:bg-surface-2">
            Use {suggested}
          </button>
        )}
        {symbol.trim() && (
          <button type="button" onClick={() => setSymbol("")} className="rounded-full px-2 py-0.5 hover:bg-surface-2">Show {valid ? code.toUpperCase() : "code"} instead</button>
        )}
      </p>

      <fieldset className="space-y-3 rounded-xl border border-rule p-4">
        <legend className="px-1 text-sm font-semibold">Also track</legend>
        <Toggle name="manageInvestment" label="Investments" on={d.manageInvestment ?? true} />
        <Toggle name="manageDonation" label="Donations" on={d.manageDonation ?? true} />
      </fieldset>
    </>
  );
}

function Toggle({ name, label, on }: { name: string; label: string; on: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={on} role="switch" className="switch" />
      {label}
    </label>
  );
}
