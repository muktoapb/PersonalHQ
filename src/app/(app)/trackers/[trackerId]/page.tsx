import { Fire, PencilSimple } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppIcon } from "@/components/AppIcon";
import { StatsBar } from "@/components/StatsBar";
import { EntryList, HabitCalendar, HabitToday, ProgressLine, ProgressRing, QuickLog, RatingPicker, SinceReset, TrackerChart } from "@/components/Trackers";
import { requireSession } from "@/lib/auth";
import { getTracker } from "@/lib/core/trackers";
import { today } from "@/lib/dates";
import { fmtNum as fmt, moodFace } from "@/lib/format";

type Props = { params: Promise<{ trackerId: string }> };

export async function generateMetadata({ params }: Props) {
  return { title: (await getTracker((await params).trackerId))?.name ?? "Trackers" };
}

const PERIOD: Record<string, string> = { all: "all time", day: "today", week: "this week", month: "this month", year: "this year" };

export default async function TrackerPage({ params }: Props) {
  const s = await requireSession();
  const t = await getTracker((await params).trackerId);
  if (!t) notFound();
  const sum = t.summary;
  const habit = t.mode === "check", since = t.mode === "since", rating = t.mode === "rating";
  const average = t.mode === "average";
  const limit = t.goal === "atMost" && t.target != null ? ` · limit ${fmt(t.target, s.locale, t.unit)}` : "";
  const subtitle =
    habit ? (t.period === "day" ? "Habit · every day" : `Habit · ${t.target ?? 1}× per ${t.period}`)
    : since ? "Days since"
    : rating ? "Mood · 1–5 each day"
    : `${t.mode === "latest" ? "Latest reading" : average ? `Average per day ${PERIOD[t.period]}` : `Total ${PERIOD[t.period]}`}${t.unit ? ` · ${t.unit}` : ""}${limit}`;
  const chartTitle =
    habit ? `Done days per ${t.period}` : since ? "Runs between resets (days)" : rating ? "Mood" : t.mode === "latest" ? "Readings"
    : t.mode === "total" && t.period === "all" ? "Running total" : `${average ? "Average per day, per" : "Per"} ${t.period === "all" ? "month" : t.period}`;
  const showChart = !(habit && t.period === "day");
  const chartKind = rating || t.mode === "latest" || (t.mode === "total" && t.period === "all") ? "line" : "bars";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-0 sm:flex-1">
          <AppIcon name={t.icon} size={48} color={t.color} />
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold">{t.name}</h1>
            <p className="text-sm text-ink-3">{subtitle}</p>
          </div>
        </div>
        <Link href={`/trackers/${t.id}/edit`} className="btn btn-ghost"><PencilSimple size={16} /> Edit</Link>
      </div>

      {since ? (
        <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <section className="card flex items-center gap-5">
            {sum.progress != null && <ProgressRing value={sum.progress} color={t.color} size={104} />}
            <div className="min-w-0">
              <p className="text-5xl font-medium tabular-nums tracking-tight">{sum.current}<span className="ml-1.5 text-lg text-ink-3">days</span></p>
              <p className="text-sm text-ink-2">best {sum.best} days</p>
              <p className="text-xs text-ink-3"><ProgressLine t={t} s={sum} locale={s.locale} /></p>
            </div>
          </section>
          <section className="card space-y-3">
            <h2 className="text-sm font-semibold">Did it happen?</h2>
            <SinceReset trackerId={t.id} />
            <p className="text-xs text-ink-3">Resetting starts the count again from today. Past resets are in the history below.</p>
          </section>
        </div>
      ) : rating ? (
        <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <section className="card flex items-center gap-5">
            <span className="text-6xl leading-none">{moodFace(sum.current)}</span>
            <div className="min-w-0">
              <p className="text-4xl font-medium tabular-nums">{fmt(sum.current, s.locale)}<span className="ml-1 text-lg text-ink-3">/ 5</span></p>
              <p className="text-sm text-ink-2">average this week</p>
              {sum.change != null && <p className="text-xs text-ink-3">{sum.change >= 0 ? "+" : ""}{fmt(sum.change, s.locale)} vs last week</p>}
            </div>
          </section>
          <section className="card space-y-3">
            <h2 className="text-sm font-semibold">How was today?</h2>
            <RatingPicker trackerId={t.id} value={sum.todayValue} date={today()} color={t.color} />
          </section>
        </div>
      ) : habit ? (
        <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
          <section className="card flex items-center gap-5">
            {t.period !== "day" && <ProgressRing value={sum.progress ?? 0} color={t.color} size={104} />}
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="flex items-center gap-1.5 text-4xl font-medium tabular-nums">
                  <Fire size={30} weight="fill" style={{ color: "var(--chart-expense)" }} /> {sum.streak}
                </p>
                <p className="text-sm text-ink-2">
                  {t.period === "day" ? "day" : t.period} streak · best {sum.best}
                </p>
                <p className="text-xs text-ink-3"><ProgressLine t={t} s={sum} locale={s.locale} /></p>
              </div>
              <HabitToday trackerId={t.id} done={sum.doneToday} color={t.color} today={today()} />
            </div>
          </section>
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Calendar <span className="font-normal text-ink-3">· tap a day to mark it</span></h2>
            <HabitCalendar trackerId={t.id} days={t.days} color={t.color} today={today()} weekStart={s.weekStart} />
          </section>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <section className="card flex items-center gap-5">
            {sum.progress != null && <ProgressRing value={sum.progress} color={t.color} size={112} />}
            <div className="min-w-0">
              <p className="text-sm text-ink-3">{t.mode === "latest" ? "Now" : `${average ? "Average per day " : ""}${PERIOD[t.period]}`.replace(/^./, (c) => c.toUpperCase())}</p>
              <p className={`text-4xl font-medium tabular-nums tracking-tight ${sum.over ? "text-danger" : ""}`}>{fmt(sum.current, s.locale)}<span className="ml-1 text-lg text-ink-3">{t.unit}</span></p>
              <p className="mt-1 text-sm text-ink-2"><ProgressLine t={t} s={sum} locale={s.locale} /></p>
              {t.target != null && (
                <p className="mt-1 text-xs text-ink-3">
                  {t.goal === "atMost" ? "Limit" : "Target"} {fmt(t.target, s.locale, t.unit)}{t.mode === "latest" && sum.base != null ? ` · from ${fmt(sum.base, s.locale, t.unit)}` : ""}
                </p>
              )}
            </div>
          </section>
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Log</h2>
            <QuickLog trackerId={t.id} unit={t.unit} today={today()} />
          </section>
        </div>
      )}

      {showChart && (
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold">{chartTitle}</h2>
          <TrackerChart
            points={t.chart}
            kind={chartKind}
            target={rating ? null : t.target}
            color={t.color}
            locale={s.locale}
            unit={habit || since ? "days" : rating ? "" : t.unit}
          />
        </section>
      )}

      {!habit && (
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">{since ? "Resets" : "History"} <span className="font-normal text-ink-3">· {t.entries.length}</span></h2>
          <EntryList entries={t.entries} unit={t.unit} locale={s.locale} kind={since ? "reset" : rating ? "rating" : "value"} />
        </section>
      )}

      <StatsBar
        note={t.name}
        items={
          since
            ? [
                { label: "Days", value: String(sum.current ?? 0) },
                { label: "Best", value: String(sum.best ?? 0) },
                { label: "Goal", value: t.target != null ? `${t.target} days` : "—" },
                { label: "Resets", value: String(sum.total) },
              ]
            : rating
            ? [
                { label: "Today", value: moodFace(sum.todayValue) },
                { label: "This week", value: fmt(sum.current, s.locale) },
                { label: "Days rated", value: String(sum.total) },
              ]
            : habit
            ? [
                { label: "Streak", value: String(sum.streak ?? 0) },
                { label: "Best", value: String(sum.best ?? 0) },
                { label: t.period === "day" ? "Today" : PERIOD[t.period][0].toUpperCase() + PERIOD[t.period].slice(1), value: t.period === "day" ? (sum.doneToday ? "Done" : "—") : `${sum.current}/${t.target ?? 1}` },
                { label: "Days done", value: String(sum.total) },
              ]
            : [
                { label: t.mode === "latest" ? "Now" : average ? "Avg / day" : "This period", value: fmt(sum.current, s.locale, t.unit) },
                { label: t.goal === "atMost" ? "Limit" : "Target", value: fmt(t.target, s.locale, t.unit) },
                { label: t.goal === "atMost" ? "Left" : "To go", value: t.goal === "atMost" ? (sum.over ? "Over" : fmt(sum.left, s.locale, t.unit)) : sum.reached ? "Done" : fmt(sum.left, s.locale, t.unit) },
                { label: "Entries", value: String(t.entries.length) },
              ]
        }
      />
    </div>
  );
}
