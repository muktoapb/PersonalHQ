import { AppIcon } from "@/components/AppIcon";
import { StatsBar } from "@/components/StatsBar";
import { Plus } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { TrackerCard, TrackerStart } from "@/components/Trackers";
import { requireSession } from "@/lib/auth";
import { listTrackers } from "@/lib/core/trackers";
import { today } from "@/lib/dates";

export const metadata = { title: "Trackers" };

export default async function TrackersPage() {
  const s = await requireSession();
  const list = await listTrackers();
  const goals = list.filter((t) => t.summary.progress != null);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <AppIcon name="trackers" size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold">Trackers</h1>
          <p className="mt-1 hidden text-sm text-ink-3 sm:block">Habits, amounts and readings — set targets to make them goals.</p>
        </div>
        {list.length > 0 && <Link href="/trackers/new" className="btn btn-primary"><Plus size={16} weight="bold" /> New tracker</Link>}
      </div>
      {list.length === 0 ? (
        <TrackerStart />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => <TrackerCard key={t.id} t={t} locale={s.locale} today={today()} />)}
        </div>
      )}
      {list.length > 0 && (
        <StatsBar
          items={[
            { label: "Trackers", value: String(list.length) },
            { label: "With goals", value: String(goals.length) },
            { label: "Goals reached", value: String(goals.filter((t) => t.summary.reached).length) },
          ]}
        />
      )}
    </div>
  );
}
