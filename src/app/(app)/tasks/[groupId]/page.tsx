import { notFound } from "next/navigation";
import { StatsBar } from "@/components/StatsBar";
import { AddTaskForm, GroupHeader, TaskView } from "@/components/TaskView";
import { requireSession } from "@/lib/auth";
import { getGroup, listColumns, listLabels, listTasks, taskStats } from "@/lib/core/tasks";
import { today } from "@/lib/dates";

type Props = { params: Promise<{ groupId: string }>; searchParams: Promise<{ label?: string }> };

export async function generateMetadata({ params }: Props) {
  return { title: (await getGroup((await params).groupId))?.name ?? "Tasks" };
}

export default async function TaskGroupPage({ params, searchParams }: Props) {
  const s = await requireSession();
  const [{ groupId }, { label }] = await Promise.all([params, searchParams]);
  const group = await getGroup(groupId);
  if (!group) notFound();
  const [items, labels, columns, st] = await Promise.all([listTasks(groupId, label), listLabels(), listColumns(groupId), taskStats(groupId)]);
  return (
    <div className={`mx-auto space-y-5 ${group.view === "board" ? "max-w-none" : "max-w-3xl"}`}>
      <GroupHeader group={group} labels={labels} labelId={label} />
      <AddTaskForm groupId={group.id} />
      <TaskView tasks={items} view={group.view} columns={columns} today={today()} locale={s.locale} labels={labels} />
      <StatsBar
        note={group.name}
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
