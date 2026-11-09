// Calendar helpers on "YYYY-MM-DD" / "YYYY-MM" strings (server local time).

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
// The calendar date n days from today.
export const daysFromToday = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

// The calendar date n days after a "YYYY-MM-DD".
export const addDays = (d: string, n: number) => { const [y, m, day] = d.split("-").map(Number); return ymd(new Date(y, m - 1, day + n)); };

// The last n months as "YYYY-MM", oldest first, ending with the current month.
export function lastMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });
}

export function monthRange(month?: string | null) {
  const m = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : today().slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const last = new Date(y, mo, 0).getDate();
  const shift = (n: number) => {
    const d = new Date(y, mo - 1 + n, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  return {
    month: m,
    from: `${m}-01`,
    to: `${m}-${pad(last)}`,
    prev: shift(-1),
    next: shift(1),
    label: new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}
