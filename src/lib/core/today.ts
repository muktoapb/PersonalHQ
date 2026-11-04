import "server-only";
import { and, asc, count, eq, gt, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { trackerEntries, trackers, tasks, transactions } from "@/db/schema";

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
