import { notFound } from "next/navigation";
import { NotesScreen } from "@/components/NotesScreen";
import { requireSession } from "@/lib/auth";
import { getCategory } from "@/lib/core/notes";

type Props = { params: Promise<{ categoryId: string }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ params }: Props) {
  return { title: (await getCategory((await params).categoryId))?.name ?? "Notes" };
}

export default async function NoteCategoryPage({ params, searchParams }: Props) {
  await requireSession();
  const [{ categoryId }, { q }] = await Promise.all([params, searchParams]);
  const category = await getCategory(categoryId);
  if (!category) notFound();
  return <NotesScreen category={category} q={q} />;
}
