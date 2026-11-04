import "server-only";
import { and, asc, count, desc, eq, gt, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { settings, taskGroups, trackerEntries, trackers, tasks, transactions } from "@/db/schema";

// The day at a glance for the Overview panel: a few cheap counts, read on
// every page (the side panel is in the app layout).
export async function todaySnapshot(today: string) {
  const open = and(isNull(tasks.parentId), ne(tasks.status, "done"));
  const [[overdue], [dueToday], [habitsTotal], [habitsDone], [spent], [next]] = await Promise.all([
    db.select({ n: count() }).from(tasks).where(and(open, lt(tasks.due, today))),
    db.select({ n: count() }).from(tasks).where(and(open, eq(tasks.due, today))),
    db.select({ n: count() }).from(trackers).where(eq(trackers.mode, "check")),
    db
      .select({ n: sql<number>`count(distinct ${trackerEntries.trackerId})` })
      .from(trackerEntries)
      .innerJoin(trackers, eq(trackers.id, trackerEntries.trackerId))
      .where(and(eq(trackers.mode, "check"), eq(trackerEntries.date, today))),
    db
      .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.kind, "expense"), eq(transactions.date, today))),
    db
      .select({ title: tasks.title, at: tasks.remindAt, groupId: tasks.groupId })
      .from(tasks)
      .where(and(ne(tasks.status, "done"), isNull(tasks.remindedAt), gt(tasks.remindAt, new Date().toISOString())))
      .orderBy(asc(tasks.remindAt))
      .limit(1),
  ]);
  return {
    overdue: overdue.n,
    dueToday: dueToday.n,
    habitsTotal: habitsTotal.n,
    habitsDone: Number(habitsDone.n),
    spentToday: Number(spent.total),
    nextReminder: next ?? null,
  };
}

export type Notice = {
  id: string;
  title: string;
  due: string | null;
  dueTime: string | null;
  remindAt: string | null;
  remindedAt: string | null;
  groupId: string;
  groupName: string;
  groupColor: string;
};

// The phone's notification sheet: what needs attention now, from live data
// (there's no separate notification inbox). Top-level open tasks only.
export async function notices(today: string) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const open = and(isNull(tasks.parentId), ne(tasks.status, "done"));
  const pick = {
    id: tasks.id,
    title: tasks.title,
    due: tasks.due,
    dueTime: tasks.dueTime,
    remindAt: tasks.remindAt,
    remindedAt: tasks.remindedAt,
    groupId: tasks.groupId,
    groupName: taskGroups.name,
    groupColor: taskGroups.color,
  };
  const base = () => db.select(pick).from(tasks).innerJoin(taskGroups, eq(taskGroups.id, tasks.groupId));
  const [overdue, dueToday, upcoming, fired] = await Promise.all([
    base().where(and(open, lt(tasks.due, today))).orderBy(asc(tasks.due), asc(tasks.dueTime)).limit(20),
    base().where(and(open, eq(tasks.due, today))).orderBy(asc(tasks.dueTime)).limit(20),
    base()
      .where(and(open, isNull(tasks.remindedAt), gt(tasks.remindAt, now.toISOString()), lt(tasks.remindAt, weekAhead)))
      .orderBy(asc(tasks.remindAt))
      .limit(10),
    // reminders that went off in the last day
    base().where(and(open, gt(tasks.remindedAt, dayAgo))).orderBy(desc(tasks.remindedAt)).limit(10),
  ]);
  return { overdue, dueToday, upcoming, fired };
}

// Opening the notification list marks everything in it as read.
export async function markNoticesSeen() {
  await db.update(settings).set({ noticesSeenAt: new Date().toISOString() }).where(eq(settings.id, 1));
}
