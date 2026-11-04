import { NotesScreen } from "@/components/NotesScreen";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Archive" };

export default async function NotesArchivePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSession();
  return <NotesScreen archived q={(await searchParams).q} />;
}
