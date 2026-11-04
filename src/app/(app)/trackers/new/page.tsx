import { CaretLeft } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { TrackerForm } from "@/components/Trackers";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "New tracker" };

export default async function NewTrackerPage() {
  await requireSession();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/trackers" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"><CaretLeft size={14} weight="bold" /> Trackers</Link>
      <h1 className="text-3xl font-semibold">New tracker</h1>
      <TrackerForm />
    </div>
  );
}
