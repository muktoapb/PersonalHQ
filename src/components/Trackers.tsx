"use client";

import { ArrowDown, ArrowUp, ChartBar, Check, CheckCircle, Fire, Gauge, HourglassMedium, PencilSimple, Plus, Smiley, Trash, X } from "@phosphor-icons/react/ssr";
import { haptic } from "@/lib/haptics";
import Link from "next/link";
import { useActionState, useOptimistic, useRef, useState, useTransition } from "react";
import type { Tracker, TrackerEntry, TrackerMode, TrackerPeriod } from "@/db/schema";
import { addEntryAction, deleteEntryAction, deleteTrackerAction, resetSinceAction, saveTrackerAction, setRatingAction, toggleCheckAction, updateEntryAction } from "@/lib/actions/trackers";
import type { TrackerCard as Card, TrackerSummary } from "@/lib/core/trackers";
import { fmtNum, moodFace, MOODS } from "@/lib/format";
import type { GroupIcon } from "@/lib/group-icons";
import { AppIcon } from "./AppIcon";
import { AppearanceFields } from "./CollectionDialog";

const PERIOD_LABEL: Record<TrackerPeriod, string> = { all: "all time", day: "today", week: "this week", month: "this month", year: "this year" };

const fmt = fmtNum;

// ---------- create / edit (a page, not a popup) ----------

type Editable = Pick<Tracker, "id" | "name" | "icon" | "color" | "unit" | "mode" | "period" | "start" | "target" | "targetDate" | "goal" | "quickAdd">;

// The kinds offered when creating a tracker; "Amount" covers both total and average.
type Kind = "check" | "amount" | "latest" | "since" | "rating";
const KINDS: { kind: Kind; title: string; hint: string; examples: string[]; color: string; Icon: typeof CheckCircle }[] = [
  { kind: "check", title: "Habit", hint: "Check off the days you did it", examples: ["Meditate", "Gym", "Read"], color: "#7262ea", Icon: CheckCircle },
  { kind: "amount", title: "Amount", hint: "Add up or average numbers", examples: ["Water", "Sleep", "Petrol", "Steps"], color: "#2a78d6", Icon: ChartBar },
  { kind: "latest", title: "Reading", hint: "Shows your latest value", examples: ["Weight", "Odometer"], color: "#1baf7a", Icon: Gauge },
  { kind: "since", title: "Days since", hint: "Count days since you last did it", examples: ["No smoking", "Last haircut"], color: "#eb6834", Icon: HourglassMedium },
  { kind: "rating", title: "Mood", hint: "Rate each day from 1 to 5", examples: ["Mood", "Energy", "Sleep quality"], color: "#eda100", Icon: Smiley },
];

// A tiny picture of what each kind looks like once it's running.
function KindPreview({ kind, color }: { kind: Kind; color: string }) {
  if (kind === "check")
    return (
      <span className="flex gap-1" aria-hidden>
        {[1, 1, 0, 1, 1, 1, 0].map((on, i) => (
          <span key={i} className="size-3 rounded-full border-2" style={on ? { background: color, borderColor: color } : { borderColor: "var(--rule)" }} />
        ))}
      </span>
    );
  if (kind === "amount")
    return (
      <span className="flex h-7 items-end gap-1" aria-hidden>
        {[45, 70, 55, 90, 65].map((h, i) => <span key={i} className="w-2 rounded-t-[3px]" style={{ height: `${h}%`, background: color, opacity: i === 3 ? 1 : 0.55 }} />)}
      </span>
    );
  if (kind === "latest")
    return (
      <svg viewBox="0 0 60 24" className="h-7 w-16" aria-hidden>
        <polyline points="2,6 14,9 26,8 38,14 50,16 58,20" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="58" cy="20" r="3" fill={color} />
      </svg>
    );
  if (kind === "since")
    return (
      <span className="text-right leading-none" aria-hidden>
        <span className="block text-xl font-semibold tabular-nums" style={{ color }}>12</span>
        <span className="text-[10px] text-ink-3">days</span>
      </span>
    );
  return <span className="text-lg tracking-tight" aria-hidden>🙁😐<span className="inline-block scale-125">🙂</span></span>;
}

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const kindOf = (m: TrackerMode): Kind => (m === "total" || m === "average" ? "amount" : m);

function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition ${value === v ? "border-accent bg-accent-strong text-white" : "border-rule hover:border-accent/40"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

// Everything about a tracker on one page: what it is, its goal, how it looks.
export function TrackerForm({ tracker }: { tracker?: Editable }) {
  const t = tracker;
  const [state, action, pending] = useActionState(saveTrackerAction, {});
  const [kind, setKind] = useState<Kind>(t ? kindOf(t.mode) : "check");
  const [agg, setAgg] = useState<"total" | "average">(t?.mode === "average" ? "average" : "total");
  const [period, setPeriod] = useState<TrackerPeriod>(t?.period ?? "day");
  const [goal, setGoal] = useState<"atLeast" | "atMost">(t?.goal ?? "atLeast");
  const [icon, setIcon] = useState<GroupIcon>((t?.icon as GroupIcon) ?? "star");
  const [color, setColor] = useState(t?.color ?? "#7262ea");
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();
  const mode: TrackerMode = kind === "amount" ? agg : kind;
  const amount = kind === "amount";
  const periods: [TrackerPeriod, string][] =
    kind === "check" ? [["day", "Every day"], ["week", "Times per week"], ["month", "Times per month"]]
    : amount ? [["day", "Per day"], ["week", "Per week"], ["month", "Per month"], ["year", "Per year"], ["all", "All time"]]
    : [];
  const pickKind = (k: Kind) => {
    setKind(k);
    if (k === "check" && !["day", "week", "month"].includes(period)) setPeriod("day");
  };
  const per = period === "all" ? (agg === "average" ? "overall" : "in total") : `per ${period}`;
  const placeholders: Record<Kind, string> = { check: "e.g. Meditate", amount: "e.g. Water", latest: "e.g. Weight", since: "e.g. No smoking", rating: "e.g. Mood" };

  return (
    <form action={action} className="space-y-5">
      {t && <input type="hidden" name="id" value={t.id} />}
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="period" value={periods.length ? period : "all"} />
      <input type="hidden" name="goal" value={goal} />

      <section className="card space-y-4">
        <div>
          <h2 className="text-base font-semibold">What do you want to track?</h2>
          <p className="text-sm text-ink-3">Pick the kind that fits — you can change it later.</p>
        </div>
        <div role="radiogroup" aria-label="Kind of tracker" className="grid gap-2.5">
          {KINDS.map(({ kind: k, title, hint, examples, color: c, Icon }) => {
            const on = kind === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pickKind(k)}
                className={`group relative flex items-center gap-4 rounded-2xl border p-3.5 text-left transition sm:p-4 ${
                  on ? "border-transparent shadow-md" : "border-rule hover:-translate-y-px hover:border-accent/40 hover:shadow-sm"
                }`}
                style={on ? { background: `color-mix(in oklab, ${c} 12%, var(--surface))`, boxShadow: `0 0 0 2px ${c}, 0 8px 24px -12px ${c}` } : undefined}
              >
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl transition group-hover:scale-105"
                  style={{ background: on ? c : `color-mix(in oklab, ${c} 16%, var(--surface))`, color: on ? "#fff" : c }}
                >
                  <Icon size={24} weight={on ? "fill" : "duotone"} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{title}</span>
                  <span className="block text-sm text-ink-2">{hint}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {examples.map((e) => (
                      <span key={e} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-3">{e}</span>
                    ))}
                  </span>
                </span>
                <span className="hidden shrink-0 sm:block"><KindPreview kind={k} color={c} /></span>
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition ${on ? "border-transparent text-white" : "border-rule"}`}
                  style={on ? { background: c } : undefined}
                  aria-hidden
                >
                  {on && <Check size={12} weight="bold" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="tr-name">Name</label>
            <input id="tr-name" name="name" required maxLength={60} defaultValue={t?.name} autoFocus={!t} placeholder={placeholders[kind]} className="input" />
          </div>
          {(amount || kind === "latest") && (
            <div>
              <label className="label" htmlFor="tr-unit">Unit <span className="font-normal">(optional)</span></label>
              <input id="tr-unit" name="unit" maxLength={20} defaultValue={t?.unit} placeholder={amount ? "glasses, hours, L, steps…" : "kg, km, score…"} className="input" />
            </div>
          )}
          {kind === "since" && !t && (
            <div>
              <label className="label" htmlFor="tr-since">Counting since</label>
              <input id="tr-since" name="since" type="date" defaultValue={localToday()} className="input" />
            </div>
          )}
        </div>
      </section>

      {kind !== "rating" && (
        <section className="card space-y-4">
          <h2 className="text-sm font-semibold">
            {kind === "check" ? "How often" : kind === "since" ? "Goal" : kind === "latest" ? "Goal" : "How it counts"}
            {(kind === "latest" || kind === "since") && <span className="font-normal text-ink-3"> (optional)</span>}
          </h2>
          {amount && (
            <Pills label="Add up or average" value={agg} onChange={setAgg} options={[["total", "Add up"], ["average", "Average per day"]]} />
          )}
          {periods.length > 0 && <Pills label="Period" value={period} onChange={setPeriod} options={periods} />}
          {amount && (
            <Pills label="Goal type" value={goal} onChange={setGoal} options={[["atLeast", "Goal: at least"], ["atMost", "Limit: at most"]]} />
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            {kind === "latest" && (
              <div>
                <label className="label" htmlFor="tr-start">Starting at</label>
                <input id="tr-start" name="start" type="number" step="any" inputMode="decimal" defaultValue={t?.start ?? ""} placeholder="First entry" className="input" />
              </div>
            )}
            {!(kind === "check" && period === "day") && (
              <div>
                <label className="label" htmlFor="tr-target">
                  {kind === "check" ? `Times per ${period}` : kind === "since" ? "Days" : kind === "latest" ? "Target" : `${goal === "atMost" ? "Limit" : "Target"} ${agg === "average" ? `(average ${per})` : per}`}
                  {amount && <span className="font-normal"> (optional)</span>}
                </label>
                <input id="tr-target" name="target" type="number" step={kind === "check" || kind === "since" ? 1 : "any"} min={kind === "check" ? 1 : undefined} inputMode="decimal" required={kind === "check"}
                  defaultValue={t?.target ?? (kind === "check" ? 3 : "")} placeholder={kind === "since" ? "e.g. 30" : kind === "latest" ? "e.g. 70" : "e.g. 8"} className="input" />
              </div>
            )}
            {(amount || kind === "latest") && (
              <div>
                <label className="label" htmlFor="tr-date">By <span className="font-normal">(optional)</span></label>
                <input id="tr-date" name="targetDate" type="date" defaultValue={t?.targetDate ?? ""} className="input" />
              </div>
            )}
            {amount && (
              <div>
                <label className="label" htmlFor="tr-quick">Quick add button <span className="font-normal">(optional)</span></label>
                <input id="tr-quick" name="quickAdd" type="number" step="any" min="0" inputMode="decimal" defaultValue={t?.quickAdd ?? ""} placeholder="e.g. 1 or 250" className="input" />
              </div>
            )}
          </div>
          <p className="text-xs text-ink-3">
            {kind === "check" ? (period === "day" ? "Check it off every day to build a streak." : "Your streak grows each period you hit this.")
              : kind === "since" ? "Reset it whenever it happens; your best run is kept."
              : amount && agg === "average" ? "Each day's entries are added up, then averaged over the days you logged."
              : amount ? "A quick add button logs that amount in one tap — handy for counters like glasses of water."
              : "Progress runs from your starting value to the target, up or down."}
          </p>
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="flex items-center gap-3 text-sm font-semibold"><AppIcon name={icon} size={32} color={color} /> Look</h2>
        <div className="max-w-md space-y-4"><AppearanceFields icon={icon} setIcon={setIcon} color={color} setColor={setColor} /></div>
      </section>

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} className="btn btn-primary px-6">{pending ? "Saving…" : t ? "Save changes" : "Create tracker"}</button>
        <Link href={t ? `/trackers/${t.id}` : "/trackers"} className="btn text-ink-2 hover:bg-surface-2">Cancel</Link>
        {t &&
          (confirming ? (
            <span className="ml-auto flex items-center gap-1">
              <button type="button" disabled={deleting} onClick={() => startDelete(async () => { await deleteTrackerAction(t.id); })} className="btn btn-danger px-3 py-1.5">Delete with all entries</button>
              <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost px-3 py-1.5">Keep</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="btn btn-danger ml-auto"><Trash size={16} /> Delete tracker</button>
          ))}
      </div>
    </form>
  );
}

// One-tap starters when there are no trackers yet.
const STARTERS = [
  { name: "Meditate", icon: "heart", color: "#7262ea", unit: "", mode: "check", period: "day" },
  { name: "Gym", icon: "fitness", color: "#e87ba4", unit: "", mode: "check", period: "week", target: "4" },
  { name: "Water", icon: "plant", color: "#2a78d6", unit: "glasses", mode: "total", period: "day", target: "8", quickAdd: "1" },
  { name: "Weight", icon: "fitness", color: "#1baf7a", unit: "kg", mode: "latest", period: "all" },
  { name: "Petrol", icon: "car", color: "#eb6834", unit: "L", mode: "total", period: "month" },
  { name: "Reading", icon: "book", color: "#eda100", unit: "pages", mode: "total", period: "month", target: "300" },
  { name: "Sleep", icon: "star", color: "#64748b", unit: "hours", mode: "average", period: "week", target: "7" },
  { name: "Screen time", icon: "game", color: "#eb6834", unit: "hours", mode: "average", period: "day", target: "2", goal: "atMost" },
  { name: "No smoking", icon: "heart", color: "#1baf7a", unit: "", mode: "since", period: "all", target: "30" },
  { name: "Mood", icon: "idea", color: "#eda100", unit: "", mode: "rating", period: "all" },
] as const;

export function TrackerStart() {
  const [state, action, pending] = useActionState(saveTrackerAction, {});
  return (
    <div className="card space-y-4 text-center">
      <div className="flex justify-center"><AppIcon name="trackers" size={56} /></div>
      <div>
        <p className="font-medium">Track anything</p>
        <p className="text-sm text-ink-3">Habits, amounts or readings — with targets to turn them into goals. Start with one of these:</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {STARTERS.map((s) => (
          <form key={s.name} action={action}>
            {Object.entries(s).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <button disabled={pending} className="btn btn-ghost pl-1.5">
              <AppIcon name={s.icon} size={26} color={s.color} /> {s.name}
            </button>
          </form>
        ))}
      </div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <div className="flex items-center gap-3 text-xs text-ink-3" aria-hidden>
        <span className="h-px flex-1 bg-rule" /> or <span className="h-px flex-1 bg-rule" />
      </div>
      <Link href="/trackers/new" className="btn btn-primary w-full sm:w-auto"><Plus size={16} weight="bold" /> Make your own tracker</Link>
    </div>
  );
}

// ---------- pieces ----------

// "-0.4 kg since last" / "62% · 12 L left" style line under a value.
export function ProgressLine({ t, s, locale }: { t: Pick<Tracker, "mode" | "period" | "unit" | "target" | "goal">; s: TrackerSummary; locale: string }) {
  if (t.mode === "check") {
    const goal = Math.max(1, t.target ?? 1);
    if (t.period === "day") return <span>{s.doneToday ? "Done today" : "Not done today"}</span>;
    return <span>{s.current} of {goal} {t.period === "week" ? "this week" : "this month"}{s.reached ? " · goal met 🎉" : ""}</span>;
  }
  if (t.mode === "since") {
    if (t.target == null) return <span>{s.total ? `Reset ${s.total} time${s.total === 1 ? "" : "s"}` : "No resets yet"}</span>;
    return <span>{s.reached ? `Goal of ${t.target} days reached 🎉` : `${fmt(s.left, locale)} days to your goal of ${t.target}`}</span>;
  }
  if (t.mode === "rating") {
    return <span>{s.current != null ? `Avg ${fmt(s.current, locale)} this week` : "No ratings this week"}{s.todayValue == null ? " · rate today" : ""}</span>;
  }
  const bits: string[] = [];
  const unit = t.unit;
  if (t.goal === "atMost" && t.target != null && s.current != null) {
    bits.push(s.over ? `${fmt(s.current - t.target, locale, unit)} over the limit` : `${fmt(s.left, locale, unit)} left of ${fmt(t.target, locale, unit)}`);
  } else {
    if (s.progress != null) bits.push(s.reached ? "Goal reached 🎉" : `${Math.round(s.progress * 100)}%`);
    if (s.left != null && !s.reached) bits.push(`${fmt(s.left, locale, unit)} to go`);
  }
  if (s.daysLeft != null && !s.reached) bits.push(s.daysLeft >= 0 ? `${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left` : `${-s.daysLeft} days past`);
  if (!bits.length && (t.mode === "total" || t.mode === "average")) bits.push(PERIOD_LABEL[t.period]);
  return <span>{bits.join(" · ")}</span>;
}

// `over` (a limit was passed) turns the bar red.
export function ProgressBar({ value, color, over = false }: { value: number | null; color: string; over?: boolean }) {
  if (value == null) return null;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(value, 1) * 100)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 1) * 100}%`, background: over ? "var(--danger)" : color }} />
    </div>
  );
}

export function ProgressRing({ value, color, size = 132 }: { value: number; color: string; size?: number }) {
  const r = 52, c = 2 * Math.PI * r, v = Math.min(value, 1);
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`${Math.round(v * 100)}% of goal`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform="rotate(-90 60 60)" />
      <text x="60" y="66" textAnchor="middle" fontSize="22" fontWeight="500" fill="var(--ink)">{Math.round(v * 100)}%</text>
    </svg>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-10" />;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - ((v - min) / span) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-10 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Log a value in one go: number (+ date, defaulting to today) and Enter.
export function QuickLog({ trackerId, unit, today, compact = false }: { trackerId: string; unit: string; today: string; compact?: boolean }) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      action={(fd) =>
        start(async () => {
          const r = await addEntryAction(trackerId, String(fd.get("value") ?? ""), String(fd.get("date") || today), String(fd.get("note") ?? ""));
          setError(r.error);
          if (!r.error) {
            form.current?.reset();
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }
        })
      }
      className="space-y-2"
    >
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input name="value" type="number" step="any" inputMode="decimal" required placeholder={compact ? "Log a value" : "Value"} aria-label="Value" className={`input ${unit ? "pr-14" : ""} ${compact ? "py-2" : ""}`} />
          {unit && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-3">{unit}</span>}
        </div>
        {!compact && <input name="date" type="date" defaultValue={today} aria-label="Date" className="input w-auto" />}
        <button disabled={pending} className={`btn btn-primary shrink-0 ${compact ? "px-3 py-2" : ""}`}>
          {saved ? <Check size={16} weight="bold" /> : pending ? "…" : "Log"}
        </button>
      </div>
      {!compact && <input name="note" maxLength={300} placeholder="Note (optional)" aria-label="Note" className="input" />}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </form>
  );
}

// ---------- habits ----------

// Big "Done today" toggle.
export function HabitToday({ trackerId, done, color, today }: { trackerId: string; done: boolean; color: string; today: string }) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { haptic(); setOptimistic(!optimistic); await toggleCheckAction(trackerId, today); })}
      aria-pressed={optimistic}
      className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition ${optimistic ? "border-transparent text-white" : "border-rule hover:border-accent/50"}`}
      style={optimistic ? { background: color } : undefined}
    >
      <Check size={16} weight="bold" /> {optimistic ? "Done today" : "Mark done today"}
    </button>
  );
}

// The last 7 days as tappable dots (tap to mark/unmark a day).
export function WeekDots({ trackerId, days, color, today }: { trackerId: string; days: string[]; color: string; today: string }) {
  const [set, toggle] = useOptimistic(new Set(days), (cur, d: string) => { const n = new Set(cur); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  const [, start] = useTransition();
  const [y, m, d0] = today.split("-").map(Number);
  const week = Array.from({ length: 7 }, (_, i) => new Date(y, m - 1, d0 - 6 + i));
  return (
    <div className="flex justify-between gap-1">
      {week.map((d) => {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const on = set.has(key);
        return (
          <button key={key} onClick={() => start(async () => { haptic(); toggle(key); await toggleCheckAction(trackerId, key); })} aria-pressed={on}
            aria-label={`${d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}: ${on ? "done" : "not done"}`}
            className="flex flex-1 flex-col items-center gap-1 text-[10px] text-ink-3">
            {d.toLocaleDateString("en-US", { weekday: "narrow" })}
            <span className={`flex size-7 items-center justify-center rounded-full border-2 transition ${on ? "border-transparent text-white" : "border-rule"} ${key === today ? "ring-2 ring-accent/40 ring-offset-1 ring-offset-surface" : ""}`} style={on ? { background: color } : undefined}>
              {on && <Check size={12} weight="bold" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// The last ~4 months, a column per week (the week's first day at the top, per
// Settings); tap a day to toggle it.
export function HabitCalendar({ trackerId, days, color, today, weekStart = 1 }: { trackerId: string; days: string[]; color: string; today: string; weekStart?: number }) {
  const [set, toggle] = useOptimistic(new Set(days), (cur, d: string) => { const n = new Set(cur); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  const [, start] = useTransition();
  const [y, m, d0] = today.split("-").map(Number);
  const now = new Date(y, m - 1, d0);
  const monday = new Date(y, m - 1, d0 - ((now.getDay() - weekStart + 7) % 7)); // first day of this week
  // The last 18 weeks, ending with this one; phones show the last 12. Squares
  // share the card's width (no sideways scrolling), so today is always in view.
  const weeks = 18, phoneWeeks = 12;
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, dd) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - (weeks - 1 - w) * 7 + dd)));
  return (
    // column by column: day letters, then one column per week
    <div className="grid max-w-sm grid-flow-col grid-cols-[auto_repeat(12,minmax(0,1fr))] grid-rows-7 gap-[3px] sm:max-w-xl sm:grid-cols-[auto_repeat(18,minmax(0,1fr))] sm:gap-1">
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} aria-hidden className="flex items-center pr-1 text-[10px] text-ink-3">{i % 2 ? "" : "SMTWTFS"[(weekStart + i) % 7]}</span>
      ))}
      {cols.flatMap((col, w) =>
        col.map((d) => {
          const k = key(d), on = set.has(k), future = k > today;
          return (
            <button key={k} disabled={future} onClick={() => start(async () => { haptic(); toggle(k); await toggleCheckAction(trackerId, k); })}
              title={`${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}${on ? " · done" : ""}`}
              aria-label={`${d.toDateString()}: ${on ? "done" : "not done"}`} aria-pressed={on}
              className={`aspect-square w-full rounded-[4px] transition sm:rounded-[5px] ${w < weeks - phoneWeeks ? "hidden sm:block" : ""} ${future ? "opacity-0" : on ? "" : "bg-surface-2 hover:ring-2 hover:ring-accent/40"} ${k === today ? "ring-2 ring-accent" : ""}`}
              style={on ? { background: color } : undefined} />
          );
        }),
      )}
    </div>
  );
}

// ---------- days since, mood, quick add ----------

// "It happened" → optional note → reset the count to 0.
export function SinceReset({ trackerId }: { trackerId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-xl border border-rule py-2.5 text-sm font-medium text-ink-2 transition hover:border-danger/50 hover:text-danger">
        Reset — it happened
      </button>
    );
  return (
    <form action={(fd) => start(async () => { await resetSinceAction(trackerId, String(fd.get("note") ?? "")); setOpen(false); })} className="space-y-2 rounded-xl bg-danger/5 p-2.5">
      <input name="note" autoFocus maxLength={300} placeholder="What happened? (optional)" aria-label="Note" className="input py-2" />
      <div className="flex gap-2">
        <button disabled={pending} className="btn btn-danger flex-1 bg-danger/10 py-1.5">Reset to 0</button>
        <button type="button" onClick={() => setOpen(false)} className="btn flex-1 py-1.5 text-ink-2 hover:bg-surface-2">Cancel</button>
      </div>
    </form>
  );
}


// Rate a day 1–5 with a tap (tap another face to change it).
export function RatingPicker({ trackerId, value, date, color }: { trackerId: string; value: number | null; date: string; color: string }) {
  const [current, setCurrent] = useOptimistic(value);
  const [, start] = useTransition();
  return (
    <div className="flex justify-between gap-1" role="radiogroup" aria-label="Rating">
      {MOODS.map((m, i) => {
        const v = i + 1, on = current === v;
        return (
          <button key={v} role="radio" aria-checked={on} aria-label={`${v} of 5`}
            onClick={() => start(async () => { haptic(); setCurrent(v); await setRatingAction(trackerId, date, v); })}
            className={`flex flex-1 items-center justify-center rounded-xl py-2 text-2xl transition ${on ? "scale-110 ring-2" : "opacity-60 grayscale hover:opacity-100 hover:grayscale-0"}`}
            style={on ? ({ "--tw-ring-color": color, background: `color-mix(in oklab, ${color} 15%, transparent)` } as React.CSSProperties) : undefined}>
            {m}
          </button>
        );
      })}
    </div>
  );
}

// One tap logs the tracker's quick-add amount for today.
function QuickAddButton({ trackerId, amount, unit, today }: { trackerId: string; amount: number; unit: string; today: string }) {
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState(false);
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { const r = await addEntryAction(trackerId, String(amount), today); if (!r.error) { setFlash(true); setTimeout(() => setFlash(false), 800); } })}
      title={`Add ${amount}${unit ? ` ${unit}` : ""}`}
      className={`btn shrink-0 border border-accent/40 px-3 py-2 font-semibold text-accent-text transition hover:bg-accent-soft ${flash ? "bg-accent-soft" : ""}`}
    >
      +{fmt(amount, "en-US")}
    </button>
  );
}

// ---------- overview card ----------

export function TrackerCard({ t, locale, today }: { t: Card; locale: string; today: string }) {
  const s = t.summary;
  const habit = t.mode === "check", since = t.mode === "since", rating = t.mode === "rating";
  const amount = t.mode === "total" || t.mode === "average";
  const subtitle =
    habit ? (t.period === "day" ? "Every day" : `${t.target ?? 1}× per ${t.period}`)
    : since ? "Days since"
    : rating ? "Mood · today"
    : t.mode === "average" ? `Avg per day ${PERIOD_LABEL[t.period]}${t.goal === "atMost" && t.target != null ? ` · limit ${fmt(t.target, locale)}` : ""}`
    : t.mode === "total" ? `Total ${PERIOD_LABEL[t.period]}${t.goal === "atMost" && t.target != null ? ` · limit ${fmt(t.target, locale)}` : ""}`
    : "Latest";
  return (
    <article className="card flex flex-col gap-3">
      <Link href={`/trackers/${t.id}`} className="-m-1 flex items-center gap-3 rounded-2xl p-1 hover:bg-surface-2/60">
        <AppIcon name={t.icon} size={40} color={t.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{t.name}</span>
          <span className="block truncate text-xs text-ink-3">{subtitle}</span>
        </span>
        <span className="text-right">
          {habit ? (
            <span className="flex items-center gap-1 text-xl font-medium tabular-nums" title="Current streak"><Fire size={18} weight="fill" style={{ color: "var(--chart-expense)" }} />{s.streak ?? 0}</span>
          ) : rating ? (
            <span className="block text-2xl leading-none">{moodFace(s.todayValue)}</span>
          ) : (
            <span className={`block text-xl font-medium tabular-nums ${s.over ? "text-danger" : ""}`}>{fmt(s.current, locale)}</span>
          )}
          <span className="block text-xs text-ink-3">{habit || since ? `best ${s.best ?? 0}` : rating ? "" : t.unit}{since ? " · days" : ""}</span>
        </span>
      </Link>
      {habit ? <WeekDots trackerId={t.id} days={t.recentDays} color={t.color} today={today} /> : <Sparkline values={t.spark} color={t.color} />}
      {!(habit && t.period === "day") && !rating && <ProgressBar value={s.progress} color={t.color} over={s.over} />}
      <p className={`flex items-center gap-1 text-xs ${s.over ? "text-danger" : "text-ink-3"}`}>
        {s.change != null && s.change !== 0 && !rating && (
          <span className="inline-flex items-center gap-0.5">
            {s.change > 0 ? <ArrowUp size={12} weight="bold" /> : <ArrowDown size={12} weight="bold" />}
            {fmt(Math.abs(s.change), locale, t.unit)} ·
          </span>
        )}
        {t.entryCount || habit || rating || since ? <ProgressLine t={t} s={s} locale={locale} /> : "No entries yet"}
      </p>
      <div className="mt-auto">
        {habit ? <HabitToday trackerId={t.id} done={s.doneToday} color={t.color} today={today} />
          : since ? <SinceReset trackerId={t.id} />
          : rating ? <RatingPicker trackerId={t.id} value={s.todayValue} date={today} color={t.color} />
          : (
            <div className="flex gap-2">
              <div className="min-w-0 flex-1"><QuickLog trackerId={t.id} unit={t.unit} today={today} compact /></div>
              {amount && t.quickAdd != null && <QuickAddButton trackerId={t.id} amount={t.quickAdd} unit={t.unit} today={today} />}
            </div>
          )}
      </div>
    </article>
  );
}

// ---------- chart ----------

// Readings / running totals as a line, per-period totals as bars; a dashed
// line marks the target. Hover or focus a point/bar for its value.
export function TrackerChart({ points, kind, target, color, locale, unit }: {
  points: { label: string; value: number; date: string }[];
  kind: "line" | "bars";
  target: number | null;
  color: string;
  locale: string;
  unit: string;
}) {
  if (!points.length) return <p className="py-10 text-center text-sm text-ink-3">Log a few values to see the chart.</p>;
  const values = points.map((p) => p.value).concat(target != null ? [target] : []);
  let min = kind === "bars" ? 0 : Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.1;
  if (kind === "line") { min -= pad; max += pad; } else max += pad;
  const y = (v: number) => 100 - ((v - min) / (max - min)) * 100;
  const x = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100);
  const every = Math.ceil(points.length / 8);

  return (
    <div>
      <div className="flex">
        <div className="relative h-52 w-14 shrink-0 text-[11px] text-ink-3" aria-hidden>
          {[max, (max + min) / 2, min].map((v, i) => (
            <span key={i} className="absolute right-2 -translate-y-1/2 tabular-nums" style={{ top: `${i * 50}%` }}>{fmt(v, locale)}</span>
          ))}
        </div>
        <div className="relative h-52 flex-1">
          {[0, 50, 100].map((t) => <div key={t} className="absolute inset-x-0 border-t border-rule" style={{ top: `${t}%` }} />)}
          {target != null && (
            <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed" style={{ top: `${y(target)}%`, borderColor: color }}>
              <span className="absolute -top-5 right-0 rounded-full border border-rule bg-surface px-1.5 text-[11px] text-ink-2 shadow-sm">Target {fmt(target, locale, unit)}</span>
            </div>
          )}
          {kind === "line" ? (
            <>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
              {points.map((p, i) => (
                <span key={p.date + i} tabIndex={0} className="group absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface outline-none" style={{ left: `${x(i)}%`, top: `${y(p.value)}%`, background: color }}>
                  <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-rule bg-surface px-2 py-1 text-xs shadow-lg group-hover:block group-focus:block">
                    {p.label}: <b className="tabular-nums">{fmt(p.value, locale, unit)}</b>
                  </span>
                </span>
              ))}
            </>
          ) : (
            <div className="absolute inset-0 flex items-end gap-1.5">
              {points.map((p) => (
                <div key={p.date} tabIndex={0} className="group relative flex h-full flex-1 items-end justify-center outline-none">
                  <div className="w-full max-w-7 rounded-t-[4px] transition group-hover:opacity-80" style={{ height: `${p.value > 0 ? Math.max(100 - y(p.value), 1) : 0}%`, background: color }} />
                  <span role="tooltip" className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-lg border border-rule bg-surface px-2 py-1 text-xs shadow-lg group-hover:block group-focus:block">
                    {p.label}: <b className="tabular-nums">{fmt(p.value, locale, unit)}</b>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="ml-14 mt-2 flex text-[11px] text-ink-3" aria-hidden>
        {points.map((p, i) => (
          <span key={p.date + i} className={`flex-1 text-center ${i % every ? "invisible" : ""} ${kind === "line" ? "first:text-left last:text-right" : ""}`}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}

// ---------- history ----------

// `kind` changes how each entry reads: a value, a reset ("days since"), or a mood face.
export function EntryList({ entries, unit, locale, kind = "value" }: { entries: TrackerEntry[]; unit: string; locale: string; kind?: "value" | "reset" | "rating" }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  if (!entries.length) return <p className="py-6 text-center text-sm text-ink-3">No entries yet.</p>;
  const day = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };
  return (
    <ul className="space-y-2">
      {entries.map((e) =>
        editing === e.id ? (
          <li key={e.id}>
            <form
              action={(fd) =>
                start(async () => {
                  const r = await updateEntryAction(e.id, { value: String(fd.get("value") ?? ""), date: String(fd.get("date") ?? ""), note: String(fd.get("note") ?? "") });
                  setError(r.error);
                  if (!r.error) setEditing(null);
                })
              }
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-accent/50 p-2.5"
            >
              {kind === "reset" ? <input type="hidden" name="value" value={e.value} /> : (
                <input name="value" type="number" step={kind === "rating" ? 1 : "any"} min={kind === "rating" ? 1 : undefined} max={kind === "rating" ? 5 : undefined} inputMode="decimal" defaultValue={e.value} required aria-label="Value" className="input w-28 py-1.5" />
              )}
              <input name="date" type="date" defaultValue={e.date} required aria-label="Date" className="input w-auto py-1.5" />
              <input name="note" defaultValue={e.note ?? ""} maxLength={300} placeholder="Note" aria-label="Note" className="input min-w-0 flex-1 basis-40 py-1.5" />
              <button disabled={pending} className="btn btn-primary px-3 py-1.5 text-xs">Save</button>
              <button type="button" onClick={() => setEditing(null)} aria-label="Cancel" className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2"><X size={16} /></button>
              {error && <p role="alert" className="w-full text-xs text-danger">{error}</p>}
            </form>
          </li>
        ) : (
          <li key={e.id} className="group flex items-center gap-3 rounded-2xl border border-rule px-3.5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium tabular-nums">{kind === "reset" ? (e.note === "Started" ? "Started counting" : "Reset") : kind === "rating" ? `${moodFace(e.value)} ${e.value}/5` : fmt(e.value, locale, unit)}</p>
              <p className="truncate text-xs text-ink-3">{day(e.date)}{e.note && !(kind === "reset" && e.note === "Started") ? ` · ${e.note}` : ""}</p>
            </div>
            <button onClick={() => { setError(undefined); setEditing(e.id); }} aria-label="Edit entry" className="rounded-full p-2 text-ink-3 hover:bg-surface-2 hover:text-ink"><PencilSimple size={16} /></button>
            <button disabled={pending} onClick={() => start(async () => { await deleteEntryAction(e.id); })} aria-label="Delete entry" className="rounded-full p-2 text-ink-3 hover:bg-danger/10 hover:text-danger"><Trash size={16} /></button>
          </li>
        ),
      )}
    </ul>
  );
}
