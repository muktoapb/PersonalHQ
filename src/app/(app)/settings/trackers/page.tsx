import { WeekStartForm } from "@/components/SettingsForms";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Trackers · Settings" };

export default async function TrackerSettings() {
  const s = await requireSession();
  return (
    <>
      <h1 className="text-3xl font-semibold">Trackers</h1>
      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold">Week starts on</h2>
          <p className="text-sm text-ink-3">Used for weekly habits and streaks, weekly totals and averages, and the habit calendar.</p>
        </div>
        <WeekStartForm value={s.weekStart} />
      </section>
    </>
  );
}
