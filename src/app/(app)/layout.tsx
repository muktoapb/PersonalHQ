import { cookies } from "next/headers";
import { AddCardLink } from "@/components/CollectionDialog";
import { DesktopScroll, PageTransition, PullToRefresh, SheetGestures } from "@/components/AppShell";
import { InstallBanner } from "@/components/Pwa";
import { WalletsProvider } from "@/components/WalletsContext";
import { ReminderWatcher } from "@/components/ReminderWatcher";
import { type NavItem, SideNav } from "@/components/SideNav";
import { CategoryDialog } from "@/components/NoteBoard";
import { GroupDialog } from "@/components/TaskGroups";
import { QuickAddSheet } from "@/components/QuickAddSheet";
import { requireSession } from "@/lib/auth";
import { listCategories as financeCategories } from "@/lib/core/finance";
import { listCategories } from "@/lib/core/notes";
import { listGroups } from "@/lib/core/tasks";
import { listTrackerNames } from "@/lib/core/trackers";
import { todaySnapshot } from "@/lib/core/today";
import { walletOptions } from "@/lib/core/wallets";
import { today as todayStr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { spaceTitle } from "@/lib/brand";
import { financePages, SETTINGS_PAGES } from "@/lib/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const today = todayStr();
  const [groups, categories, trackerList, walletList, day, expenseCats] = await Promise.all([
    listGroups(),
    listCategories(),
    listTrackerNames(),
    walletOptions(),
    todaySnapshot(today),
    financeCategories("expense"),
  ]);
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const reminderTime = day.nextReminder?.at
    ? new Date(day.nextReminder.at).toLocaleString(s.locale, {
        ...(new Date(day.nextReminder.at).toDateString() === new Date().toDateString() ? {} : { weekday: "short" }),
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const quickAdd = {
    groups: groups.map(({ id, name }) => ({ id, name })),
    expenseCategories: expenseCats.map(({ id, name }) => ({ id, name })),
    trackers: trackerList.map(({ id, name, mode, unit, quickAdd }) => ({ id, name, mode, unit, quickAdd })),
    currency: s.currencySymbol || s.currency, // form labels only
    today,
  };
  const items = [
    {
      href: "/",
      label: "Overview",
      icon: "overview",
      blurb: "Your day at a glance",
      // Today, live: each row opens where you'd act on it.
      children: [
        ...(day.overdue
          ? [{ href: "/tasks#overdue", label: "Overdue", icon: "overdue" as const, hint: plural(day.overdue, "task"), color: "#d92d20" }]
          : []),
        { href: "/tasks#today", label: "Due today", icon: "tasks" as const, hint: day.dueToday ? plural(day.dueToday, "task") : "Nothing due" },
        ...(day.habitsTotal
          ? [{ href: "/trackers", label: "Habits", icon: "trackers" as const, hint: day.habitsDone >= day.habitsTotal ? "All done today" : `${day.habitsDone} of ${day.habitsTotal} done today` }]
          : []),
        { href: "/finance/expenses", label: "Spent today", icon: "expense" as const, hint: formatMoney(day.spentToday, s.currency, s.locale, s.currencySymbol) },
        ...(day.nextReminder && reminderTime
          ? [{ href: `/tasks/${day.nextReminder.groupId}`, label: "Next reminder", icon: "bell" as const, hint: `${reminderTime} · ${day.nextReminder.title}` }]
          : []),
      ],
      action: <QuickAddSheet trigger="card" {...quickAdd} />,
    },
    {
      href: "/tasks",
      label: "Tasks",
      icon: "tasks",
      blurb: "Groups, lists and boards",
      action: <GroupDialog trigger="card" />,
      children: [
        { href: "/tasks", label: "All tasks", icon: "tasks" },
        ...groups.map((g) => ({ href: `/tasks/${g.id}`, label: g.name, icon: g.icon, color: g.color })),
      ],
    },
    {
      href: "/notes",
      label: "Notes",
      icon: "notes",
      blurb: "Ideas, lists and more",
      action: <CategoryDialog trigger="card" />,
      children: [
        { href: "/notes", label: "All notes", icon: "notes" },
        ...categories.map((c) => ({ href: `/notes/${c.id}`, label: c.name, icon: c.icon, color: c.color })),
        { href: "/notes/archive", label: "Archive", icon: "archive" },
      ],
    },
    {
      href: "/finance",
      label: "Finance",
      icon: "finance",
      blurb: "Money in and out",
      compact: true,
      drill: true,
      children: financePages(s),
    },
    {
      href: "/trackers",
      label: "Trackers",
      icon: "trackers",
      blurb: "Track anything, reach targets",
      drill: true,
      action: <AddCardLink href="/trackers/new" label="Add tracker" />,
      children: [
        { href: "/trackers", label: "All trackers", icon: "trackers" },
        ...trackerList.map((t) => ({ href: `/trackers/${t.id}`, label: t.name, icon: t.icon, color: t.color })),
      ],
    },
    {
      href: "/settings",
      label: "Settings",
      icon: "settings",
      blurb: "Profile and each module",
      compact: true,
      drill: true,
      desktopHref: "/settings/profile",
      children: SETTINGS_PAGES.map(({ href, label, icon, group }) => ({ href, label, icon, group })),
    },
  ] satisfies NavItem[];
  const theme = (await cookies()).get("theme")?.value;
  return (
    // lg+: a fixed frame holding one board; the page scrolls inside the board.
    // Wallets for every transaction form: pages, the side panel and the
    // quick-add sheets outside the page.
    <WalletsProvider wallets={walletList}>
      <div className="lg:h-dvh lg:p-3">
        <div className="lg:h-full lg:rounded-[40px] lg:bg-frame lg:p-3">
          <div className="lg:flex lg:h-full lg:overflow-hidden lg:rounded-[34px] lg:bg-board">
            <SideNav
              items={items}
              name={spaceTitle(s)}
              theme={theme === "light" || theme === "dark" ? theme : undefined}
            />
            {/* Positioned wrapper for a page's <StatsBar>: main (the scroller) is not
                positioned, so the bar pins to the board edge instead of scrolling. */}
            <div className="relative min-w-0 flex-1">
              <main className="h-full px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 lg:overflow-y-auto lg:px-6 lg:pb-28 lg:pt-6">
                <PageTransition>{children}</PageTransition>
              </main>
            </div>
          </div>
        </div>
        <ReminderWatcher />
        <InstallBanner />
        <PullToRefresh />
        <QuickAddSheet trigger="fab" {...quickAdd} />
        <SheetGestures />
        <DesktopScroll />
      </div>
    </WalletsProvider>
  );
}
