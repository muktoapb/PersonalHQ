import { LabelsManager, RemindersCard } from "@/components/SettingsForms";
import { requireSession } from "@/lib/auth";
import { listLabels } from "@/lib/core/tasks";

export const metadata = { title: "Tasks · Settings" };

export default async function TaskSettings() {
  await requireSession();
  const labels = await listLabels();
  return (
    <>
      <h1 className="text-3xl font-semibold">Tasks</h1>
      <section className="card space-y-4">
        <h2 className="font-semibold">Labels</h2>
        <LabelsManager labels={labels} />
      </section>
      <section className="card space-y-4">
        <h2 className="font-semibold">Reminders</h2>
        <RemindersCard />
      </section>
    </>
  );
}
