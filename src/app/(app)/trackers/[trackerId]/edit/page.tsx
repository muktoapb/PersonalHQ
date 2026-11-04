import { CaretLeft } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackerForm } from "@/components/Trackers";
import { requireSession } from "@/lib/auth";
import { getTracker } from "@/lib/core/trackers";

type Props = { params: Promise<{ trackerId: string }> };

export async function generateMetadata({ params }: Props) {
  const t = await getTracker((await params).trackerId);
  return { title: t ? `Edit ${t.name}` : "Trackers" };
}

export default async function EditTrackerPage({ params }: Props) {
  await requireSession();
  const t = await getTracker((await params).trackerId);
  if (!t) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={`/trackers/${t.id}`} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"><CaretLeft size={14} weight="bold" /> {t.name}</Link>
      <h1 className="text-3xl font-semibold">Edit tracker</h1>
      <TrackerForm tracker={t} />
    </div>
  );
}
