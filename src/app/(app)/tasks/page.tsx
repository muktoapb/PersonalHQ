import { SectionFilterButton } from "@/components/AppShell";
import { AppIcon } from "@/components/AppIcon";
import { StatsBar } from "@/components/StatsBar";
import { TaskStart } from "@/components/TaskGroups";
import { AddTaskForm, TaskView } from "@/components/TaskView";
import { requireSession } from "@/lib/auth";
import { listColumns, listGroups, listLabels, listTasks, taskStats } from "@/lib/core/tasks";
import { today } from "@/lib/dates";

export const metadata = { title: "All tasks" };

// Every task from every group in one list, with a quick add that picks the group.
export default async function AllTasksPage() {
  const s = await requireSession();
  const [groups, items, columns, labels, st] = await Promise.all([listGroups(), listTasks(), listColumns(), listLabels(), taskStats()]);
  const info = groups.map(({ id, name, color, icon }) => ({ id, name, color, icon }));
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <AppIcon name="tasks" size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold">All tasks</h1>
          <p className="mt-1 text-sm text-ink-3">
            {st.open} open{st.dueToday ? ` · ${st.dueToday} due today` : ""}{st.overdue ? ` · ${st.overdue} overdue` : ""}
          </p>
        </div>
        <SectionFilterButton label="Task groups" />
      </div>
      {groups.length === 0 ? (
        <TaskStart />
      ) : (
        <>
          <AddTaskForm groups={info} />
          <TaskView tasks={items} view="all" columns={columns} groups={info} today={today()} locale={s.locale} labels={labels} />
        </>
      )}
      <StatsBar
        note="All groups"
        items={[
          { label: "Open", value: String(st.open) },
          { label: "Due today", value: String(st.dueToday) },
          { label: "Overdue", value: String(st.overdue) },
          { label: "Done this week", value: String(st.doneWeek) },
        ]}
      />
    </div>
  );
}
