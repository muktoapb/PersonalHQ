"use client";

import { useId, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/money";

// Finance charts: one y-axis, thin marks, a hover/keyboard crosshair with a
// tooltip on every chart, and a legend for two or more series (click to hide
// one). Values are minor units (cents); `money` formats them.

export type Money = { currency: string; locale: string; symbol?: string | null };
export type ChartSeries = { key: string; label: string; color: string; values: number[] };
type Labels = { short: string; long: string }[];

const useFormat = ({ currency, locale, symbol }: Money) =>
  useMemo(
    () => ({
      full: (v: number) => formatMoney(v, currency, locale, symbol, { maximumFractionDigits: 0 }),
      compact: (v: number) => formatMoney(v, currency, locale, symbol, { notation: "compact", maximumFractionDigits: 1 }),
    }),
    [currency, locale, symbol],
  );

// Rounds up to 1, 2, 2.5 or 5 × a power of ten so ticks are clean.
function niceCeil(v: number) {
  if (v <= 0) return 0;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((n) => n * p >= v) ?? 10) * p;
}

// A smooth line through the points that never overshoots them (monotone cubic).
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  const n = pts.length;
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const m = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
  const t = pts.map((_, i) => (i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = dx[i] / 3;
    d += ` C${x0 + h},${y0 + t[i] * h} ${x1 - h},${y1 - t[i + 1] * h} ${x1},${y1}`;
  }
  return d;
}

function Legend({ series, hidden, toggle }: { series: ChartSeries[]; hidden: Set<string>; toggle: (k: string) => void }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
      {series.map((s) => (
        <li key={s.key}>
          <button
            type="button"
            onClick={() => toggle(s.key)}
            aria-pressed={!hidden.has(s.key)}
            className={`flex items-center gap-1.5 rounded-md transition ${hidden.has(s.key) ? "opacity-40" : ""}`}
          >
            <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
            {s.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

// Lines with soft fills ("area") or grouped bars ("bars") over time.
// `diverging`: values may go below zero (e.g. savings). `average`: a dashed
// reference line for a single series.
export function TrendChart({
  labels,
  series,
  money,
  variant = "area",
  diverging = false,
  average,
  height = 240,
  title,
}: {
  labels: Labels;
  series: ChartSeries[];
  money: Money;
  variant?: "area" | "bars";
  diverging?: boolean;
  average?: number | null;
  height?: number;
  title: string;
}) {
  const fmt = useFormat(money);
  const gid = useId().replace(/:/g, "");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const shown = series.filter((s) => !hidden.has(s.key));
  const n = labels.length;

  const toggle = (k: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(k)) next.delete(k);
      else if (series.length - next.size > 1) next.add(k); // keep one visible
      return next;
    });

  const all = shown.flatMap((s) => s.values).concat(average ?? []);
  const top = niceCeil(Math.max(0, ...all)) || 100;
  const bottom = diverging ? -niceCeil(-Math.min(0, ...all)) : 0;
  const span = top - bottom || 1;
  const yPct = (v: number) => ((top - v) / span) * 100; // % from the top
  const ticks = diverging ? [top, top / 2, 0, bottom / 2, bottom].filter((v, i, a) => a.indexOf(v) === i) : [top, (top * 3) / 4, top / 2, top / 4, 0];
  const W = 1000, H = 100; // SVG units; scaled to the box (strokes don't scale)
  const x = (i: number) => ((i + 0.5) / n) * W;
  const y = (v: number) => (yPct(v) / 100) * H;
  const every = Math.max(1, Math.ceil(n / (n > 20 ? 7 : 8)));

  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setHover(Math.min(n - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * n))));
  };
  const zeroPct = yPct(0);

  return (
    <figure className="space-y-4">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        {series.length > 1 && <Legend series={series} hidden={hidden} toggle={toggle} />}
      </figcaption>
      <div className="flex">
        {/* y-axis labels */}
        <div className="relative w-16 shrink-0 text-[11px] text-ink-3" style={{ height }} aria-hidden>
          {ticks.map((v) => (
            <span key={v} className="absolute right-2.5 -translate-y-1/2 whitespace-nowrap tabular-nums" style={{ top: `${yPct(v)}%` }}>{fmt.compact(v)}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div
            ref={box}
            tabIndex={0}
            role="img"
            aria-label={`${title}. Use the arrow keys to read each ${labels[0]?.short.length > 4 ? "day" : "period"}.`}
            onPointerMove={(e) => pick(e.clientX)}
            onPointerDown={(e) => pick(e.clientX)}
            onPointerLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
              else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
              else if (e.key === "Escape") setHover(null);
              else return;
              e.preventDefault();
            }}
            className="relative cursor-crosshair touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            style={{ height }}
          >
            {/* grid */}
            {ticks.map((v) => (
              <div key={v} className={`absolute inset-x-0 border-t ${v === 0 ? "border-ink-3/40" : "border-dashed border-rule"}`} style={{ top: `${yPct(v)}%` }} />
            ))}

            {variant === "bars" ? (
              <div className="absolute inset-0 flex">
                {labels.map((_, i) => (
                  <div key={i} className={`relative flex-1 transition-colors ${hover === i ? "bg-surface-2/70" : ""}`}>
                    <div className="absolute inset-y-0 left-[16%] right-[16%] flex justify-center gap-[2px]">
                      {shown.map((s) => {
                        const v = s.values[i] ?? 0;
                        const up = v >= 0;
                        return (
                          <div key={s.key} className="relative h-full max-w-7 flex-1">
                            <div
                              className={`absolute inset-x-0 ${up ? "rounded-t-[4px]" : "rounded-b-[4px]"}`}
                              style={{
                                top: `${up ? yPct(v) : zeroPct}%`,
                                height: `${Math.max(Math.abs(yPct(v) - zeroPct), v ? 0.8 : 0)}%`,
                                background: diverging && !up ? "var(--chart-expense)" : s.color,
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
                <defs>
                  {shown.map((s) => (
                    <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={shown.length > 2 ? 0.14 : 0.22} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                {shown.map((s) => {
                  const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
                  const line = smoothPath(pts);
                  return (
                    <g key={s.key}>
                      {pts.length > 1 && <path d={`${line} L${pts.at(-1)![0]},${y(0)} L${pts[0][0]},${y(0)} Z`} fill={`url(#${gid}-${s.key})`} />}
                      <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </g>
                  );
                })}
              </svg>
            )}

            {average != null && average > 0 && (
              <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink-3/70" style={{ top: `${yPct(average)}%` }}>
                <span className="absolute -top-5 right-0 rounded bg-surface px-1 text-[11px] text-ink-2">avg {fmt.compact(average)}</span>
              </div>
            )}

            {/* single-point series: show the point */}
            {variant === "area" && n === 1 && shown.map((s) => (
              <span key={s.key} className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: "50%", top: `${yPct(s.values[0] ?? 0)}%`, background: s.color }} />
            ))}

            {hover !== null && (
              <>
                {variant === "area" && (
                  <>
                    <div className="pointer-events-none absolute inset-y-0 border-l border-ink-3/60" style={{ left: `${((hover + 0.5) / n) * 100}%` }} />
                    {shown.map((s) => (
                      <span
                        key={s.key}
                        className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
                        style={{ left: `${((hover + 0.5) / n) * 100}%`, top: `${yPct(s.values[hover] ?? 0)}%`, background: s.color }}
                      />
                    ))}
                  </>
                )}
                <div
                  role="tooltip"
                  className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-xl border border-rule bg-surface px-3 py-2 text-xs shadow-xl"
                  style={hover < n / 2 ? { left: `calc(${((hover + 0.5) / n) * 100}% + 12px)` } : { right: `calc(${100 - ((hover + 0.5) / n) * 100}% + 12px)` }}
                >
                  <p className="mb-1.5 font-semibold text-ink">{labels[hover].long}</p>
                  {shown.map((s) => (
                    <p key={s.key} className="flex items-center gap-1.5 py-0.5 text-ink-2">
                      <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
                      {s.label}
                      <b className="ml-auto pl-4 font-medium tabular-nums text-ink">{fmt.full(s.values[hover] ?? 0)}</b>
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* x-axis labels */}
          <div className="relative mt-2 h-4 text-[11px] text-ink-3" aria-hidden>
            {labels.map((l, i) =>
              i % every === 0 ? (
                <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${((i + 0.5) / n) * 100}%` }}>{l.short}</span>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </figure>
  );
}

// A donut of category shares with a ranked list; hover or focus a slice or
// row to read it in the middle. Smaller slices beyond `max` fold into "Other".
export function CategoryDonut({
  items,
  money,
  title,
  empty,
  max = 6,
}: {
  items: { key: string; label: string; value: number; color: string; count: number }[];
  money: Money;
  title: string;
  empty: string;
  max?: number;
}) {
  const fmt = useFormat(money);
  const [active, setActive] = useState<string | null>(null);
  const total = items.reduce((a, i) => a + i.value, 0);
  const shown = items.length > max
    ? [...items.slice(0, max - 1), { key: "other", label: "Other", color: "var(--ink-3)", value: items.slice(max - 1).reduce((a, i) => a + i.value, 0), count: items.slice(max - 1).reduce((a, i) => a + i.count, 0) }]
    : items;
  const R = 40, C = 2 * Math.PI * R, GAP = shown.length > 1 ? 1.6 : 0;
  // Where each slice starts along the ring.
  const starts = shown.map((_, i) => shown.slice(0, i).reduce((a, x) => a + (x.value / total) * C, 0));
  const current = shown.find((s) => s.key === active);

  return (
    <figure className="space-y-4">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {total <= 0 ? (
        <p className="py-8 text-center text-sm text-ink-3">{empty}</p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="relative size-40 shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
              {shown.map((s, i) => {
                const len = (s.value / total) * C;
                return (
                  <circle
                    key={s.key}
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={active === s.key ? 15 : 12}
                    strokeDasharray={`${Math.max(len - GAP, 0.5)} ${C}`}
                    strokeDashoffset={-starts[i]}
                    className="cursor-pointer transition-[stroke-width,opacity] duration-200"
                    style={{ opacity: active && active !== s.key ? 0.35 : 1 }}
                    onPointerEnter={() => setActive(s.key)}
                    onPointerLeave={() => setActive(null)}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <span className="max-w-full truncate text-[11px] text-ink-3">{current ? current.label : "Total"}</span>
              <span className="text-base font-semibold tabular-nums">{fmt.compact(current ? current.value : total)}</span>
              {current && <span className="text-[11px] text-ink-3">{Math.round((current.value / total) * 100)}%</span>}
            </div>
          </div>
          <ul className="w-full min-w-0 space-y-2.5">
            {shown.map((s) => (
              <li
                key={s.key}
                tabIndex={0}
                onPointerEnter={() => setActive(s.key)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(s.key)}
                onBlur={() => setActive(null)}
                className={`rounded-lg px-1 outline-none transition ${active && active !== s.key ? "opacity-50" : ""}`}
              >
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="size-2.5 shrink-0 self-center rounded-full" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  <span className="tabular-nums">{fmt.full(s.value)}</span>
                  <span className="w-9 text-right text-xs tabular-nums text-ink-3">{Math.round((s.value / total) * 100)}%</span>
                </div>
                <div className="ml-[18px] mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${(s.value / shown[0].value) * 100}%`, background: s.color }} />
                </div>
                <p className="ml-[18px] mt-0.5 text-[11px] text-ink-3">{s.count} transaction{s.count === 1 ? "" : "s"}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}
