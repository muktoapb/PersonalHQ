import { ArrowRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { AppIcon, type IconName } from "@/components/AppIcon";
import { HeroArt } from "@/components/HeroArt";
import { HabitRow, TaskRow } from "@/components/Overview";
import { StatsBar } from "@/components/StatsBar";
import { ProgressBar, ProgressLine } from "@/components/Trackers";
import { requireSession } from "@/lib/auth";
import { summarize } from "@/lib/core/finance";
import { listGroups, listTasks } from "@/lib/core/tasks";
import { listTrackers } from "@/lib/core/trackers";
import { daysFromToday, monthRange, today as todayStr } from "@/lib/dates";
import { fmtNum } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Overview" };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Card({ title, icon, href, more, className = "", children }: { title: string; icon: IconName; href: string; more: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`card ${className}`}>
      <div className="mb-2 flex items-center gap-3">
        <AppIcon name={icon} size={34} />
        <h2 className="flex-1 font-semibold">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-accent-text">
          {more} <ArrowRight size={14} />
        </Link>
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-3 text-sm text-ink-3">{children}</p>;

// The day at a glance: what's due, today's habits, trackers, and a small
// money line.
export default async function OverviewPage() {
  const s = await requireSession();
  const today = todayStr();
  const weekAhead = daysFromToday(7);
  const month = monthRange();
  const [groups, tasks, trackers, money] = await Promise.all([
    listGroups(),
    listTasks(),
    listTrackers(),
    summarize({ from: month.from, to: month.to }),
  ]);

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const open = tasks.filter((t) => t.status !== "done");
  const dueNow = open.filter((t) => t.due && t.due <= today);
  const soon = open.filter((t) => t.due && t.due > today && t.due <= weekAhead);
  const shownTasks = [...dueNow, ...soon].slice(0, 8);

  const habits = trackers.filter((t) => t.mode === "check");
  const habitsDone = habits.filter((h) => h.summary.doneToday).length;
  const daily = habits.filter((h) => h.period === "day");
  const habitsLeft = daily.filter((h) => !h.summary.doneToday).length;
  const others = trackers.filter((t) => t.mode !== "check").slice(0, 4);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const left = [dueNow.length && plural(dueNow.length, "task"), habitsLeft && plural(habitsLeft, "habit")].filter(Boolean);
  const headline = left.length ? `${left.join(" and ")} left for today` : "You're all clear for today";
  const money_ = (m: number) => formatMoney(m, s.currency, s.locale, s.currencySymbol);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="hero flex items-center gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/75">
            {greeting}{s.displayName ? `, ${s.displayName}` : ""}
            {/* phones: the date on its own line; wider screens: "… · date" */}
            <span className="hidden sm:inline"> · </span>
            <span className="block sm:inline">{new Date().toLocaleDateString(s.locale, { weekday: "long", month: "long", day: "numeric" })}</span>
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-[44px]">{headline}</h1>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/tasks" className="btn btn-primary px-6">Open tasks</Link>
            <Link href="/notes" className="btn border border-white/40 text-white hover:bg-white/10">New note</Link>
          </div>
        </div>
        <HeroArt className="hidden w-80 shrink-0 lg:block" />
      </section>

      {/* Two columns from tablets up; on phones the columns dissolve (contents)
          so the cards can interleave by importance. */}
      <div className="grid gap-6 md:grid-cols-2 md:items-start lg:grid-cols-[1.35fr_1fr]">
        <div className="contents md:block md:space-y-6">
          <Card className="order-1 md:order-none" title="Due soon" icon="tasks" href="/tasks" more="All tasks">
            {shownTasks.length ? (
              <ul className="divide-y divide-rule">
                {shownTasks.map((t) => {
                  const g = groupById.get(t.groupId);
                  return g && <TaskRow key={t.id} t={t} group={g} today={today} />;
                })}
              </ul>
            ) : (
              <Empty>{groups.length ? "Nothing due this week." : <>No task groups yet — <Link href="/tasks" className="text-accent-text hover:underline">create one</Link>.</>}</Empty>
            )}
            {open.length > shownTasks.length && (
              <p className="pt-2 text-xs text-ink-3">{plural(open.length - shownTasks.length, "more open task")} — see all tasks.</p>
            )}
          </Card>
        </div>

        <div className="contents md:block md:space-y-6">
          <Card className="order-2 md:order-none" title="Habits today" icon="trackers" href="/trackers" more="Trackers">
            {habits.length ? (
              <>
                <p className="text-xs text-ink-3">{habitsDone} of {habits.length} done</p>
                <ul className="divide-y divide-rule">
                  {habits.map((h) => (
                    <HabitRow key={h.id} h={{ id: h.id, name: h.name, color: h.color, doneToday: h.summary.doneToday, streak: h.summary.streak }} today={today} />
                  ))}
                </ul>
              </>
            ) : (
              <Empty>No habits yet — <Link href="/trackers/new" className="text-accent-text hover:underline">add one</Link>.</Empty>
            )}
          </Card>

          {others.length > 0 && (
            <section className="card order-4 space-y-4 md:order-none">
              <h2 className="font-semibold">Trackers</h2>
              <ul className="space-y-4">
                {others.map((t) => (
                  <li key={t.id}>
                    <Link href={`/trackers/${t.id}`} className="group block space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <AppIcon name={t.icon} size={28} color={t.color} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-accent-text">{t.name}</span>
                        <span className="text-sm tabular-nums">{fmtNum(t.summary.current, s.locale, t.mode === "rating" ? "" : t.unit)}</span>
                      </div>
                      <ProgressBar value={t.summary.progress} color={t.color} over={t.summary.over} />
                      <p className="text-xs text-ink-3"><ProgressLine t={t} s={t.summary} locale={s.locale} /></p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Card className="order-5 md:order-none" title={month.label} icon="finance" href="/finance" more="Finance">
            <dl className="grid grid-cols-3 gap-2 pt-1 text-sm">
              {[
                ["In", money.income, "var(--income)"],
                ["Spent", money.spentExpense + money.spentInvestment + money.spentDonation, "var(--expense)"],
                ["Saved", money.savings, undefined],
              ].map(([label, v, color]) => (
                <div key={label as string}>
                  <dt className="text-xs text-ink-3">{label}</dt>
                  <dd className="truncate font-medium tabular-nums" style={color ? { color: color as string } : undefined}>{money_(v as number)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>

      <StatsBar
        note="Today"
        items={[
          { label: "Due", value: String(dueNow.length) },
          { label: "Habits", value: habits.length ? `${habitsDone}/${habits.length}` : "—" },
          { label: "Open tasks", value: String(open.length) },
          { label: "Saved", value: money_(money.savings) },
        ]}
      />
    </div>
  );
}
