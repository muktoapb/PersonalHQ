import { NotesScreen } from "@/components/NotesScreen";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Notes" };

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSession();
  return <NotesScreen q={(await searchParams).q} />;
}
