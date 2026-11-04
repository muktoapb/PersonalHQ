// Date ranges for finance analytics: the presets and custom dates, the
// previous period each is compared with, and whether charts group by day or
// by month. Plain functions on "YYYY-MM-DD" strings (server and client safe).

export const RANGE_PRESETS = [
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom" },
] as const;
export type RangeKey = (typeof RANGE_PRESETS)[number]["key"];

export type Period = { from: string; to: string };
export type AnalyticsRange = Period & {
  key: RangeKey;
  label: string; // e.g. "1 Nov – 3 Nov 2026"
  prev: Period;
  bucket: "day" | "month";
  buckets: string[]; // every day or month in the range, oldest first
  days: number;
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const monthStart = (s: string, back = 0) => {
  const d = parse(s);
  return ymd(new Date(d.getFullYear(), d.getMonth() - back, 1, 12));
};
const monthEnd = (s: string, back = 0) => {
  const d = parse(s);
  return ymd(new Date(d.getFullYear(), d.getMonth() - back + 1, 0, 12));
};
// The same day n months earlier, kept inside shorter months (31 May -> 28 Feb).
const monthsBack = (s: string, n: number) => {
  const d = parse(s);
  const last = new Date(d.getFullYear(), d.getMonth() - n + 1, 0, 12).getDate();
  return ymd(new Date(d.getFullYear(), d.getMonth() - n, Math.min(d.getDate(), last), 12));
};
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000) + 1;
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parse(s)) === s;

// The same span of days immediately before.
const before = (p: Period): Period => {
  const len = daysBetween(p.from, p.to);
  return { from: addDays(p.from, -len), to: addDays(p.from, -1) };
};

export function analyticsRange(params: { range?: string; from?: string; to?: string }, today: string, locale = "en-US"): AnalyticsRange {
  let key = (RANGE_PRESETS.some((r) => r.key === params.range) ? params.range : "month") as RangeKey;
  let p: Period, prev: Period;
  switch (key) {
    case "last-month":
      p = { from: monthStart(today, 1), to: monthEnd(today, 1) };
      prev = { from: monthStart(today, 2), to: monthEnd(today, 2) };
      break;
    // Rolling: the same day n months ago up to today (4 Aug – 4 Nov), and
    // the n months before that.
    case "3m":
    case "6m": {
      const n = key === "3m" ? 3 : 6;
      p = { from: monthsBack(today, n), to: today };
      const prevTo = addDays(p.from, -1);
      prev = { from: monthsBack(prevTo, n), to: prevTo };
      break;
    }
    case "year": {
      const y = today.slice(0, 4);
      p = { from: `${y}-01-01`, to: today };
      const lastYear = `${Number(y) - 1}${today.slice(4)}`;
      prev = { from: `${Number(y) - 1}-01-01`, to: isDate(lastYear) ? lastYear : `${Number(y) - 1}-02-28` };
      break;
    }
    case "custom":
      if (isDate(params.from) && isDate(params.to) && params.from! <= params.to! && daysBetween(params.from!, params.to!) <= 3 * 366) {
        p = { from: params.from!, to: params.to! };
        prev = before(p);
        break;
      }
      key = "month"; // incomplete custom dates: fall back
    // falls through
    default: {
      // This month so far, against the same days of last month.
      p = { from: monthStart(today), to: today };
      const prevEnd = monthEnd(today, 1);
      const sameDay = `${prevEnd.slice(0, 8)}${today.slice(8)}`;
      prev = { from: monthStart(today, 1), to: isDate(sameDay) && sameDay < prevEnd ? sameDay : prevEnd };
    }
  }

  const days = daysBetween(p.from, p.to);
  const bucket = days <= 62 ? "day" : "month";
  const buckets: string[] = [];
  if (bucket === "day") for (let d = p.from; d <= p.to; d = addDays(d, 1)) buckets.push(d);
  else for (let m = p.from.slice(0, 7); m <= p.to.slice(0, 7); m = monthStart(`${m}-01`, -1).slice(0, 7)) buckets.push(m);

  const f = (s: string, opts: Intl.DateTimeFormatOptions) => parse(s).toLocaleDateString(locale, opts);
  const sameYear = p.from.slice(0, 4) === p.to.slice(0, 4);
  const label = `${f(p.from, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" })} – ${f(p.to, { day: "numeric", month: "short", year: "numeric" })}`;
  return { key, ...p, label, prev, bucket, buckets, days };
}

// Axis and tooltip labels for a bucket key.
export function bucketLabels(key: string, locale = "en-US") {
  if (key.length === 7) {
    const d = parse(`${key}-01`);
    return { short: d.toLocaleDateString(locale, { month: "short" }), long: d.toLocaleDateString(locale, { month: "long", year: "numeric" }) };
  }
  const d = parse(key);
  return { short: d.toLocaleDateString(locale, { day: "numeric", month: "short" }), long: d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "long" }) };
}
