import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { CategoryDialog } from "@/components/NoteBoard";
import { EmptyArchive } from "@/components/SettingsForms";
import { requireSession } from "@/lib/auth";
import { listCategories, listNotes } from "@/lib/core/notes";

export const metadata = { title: "Notes · Settings" };

export default async function NoteSettings() {
  await requireSession();
  const [categories, archived] = await Promise.all([listCategories(), listNotes({ archived: true })]);
  return (
    <>
      <h1 className="text-3xl font-semibold">Notes</h1>
      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Categories</h2>
          <CategoryDialog trigger="button" />
        </div>
        {categories.length ? (
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-rule px-3 py-2">
                <AppIcon name={c.icon} size={32} color={c.color} />
                <Link href={`/notes/${c.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent-text">{c.name}</Link>
                <CategoryDialog category={c} trigger="edit" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No categories yet.</p>
        )}
        <p className="text-xs text-ink-3">Deleting a category keeps its notes — they become uncategorised.</p>
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Archive</h2>
        <EmptyArchive count={archived.length} />
      </section>
    </>
  );
}
