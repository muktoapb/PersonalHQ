import { SectionFilterButton } from "./AppShell";
import { MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { listCategories, listNotes } from "@/lib/core/notes";
import type { GroupIcon } from "@/lib/group-icons";
import { AppIcon } from "./AppIcon";
import { CategoryDialog, NoteComposer, NoteGrid } from "./NoteBoard";

type Category = { id: string; name: string; color: string; icon: GroupIcon };

// One Notes screen: all notes, one category, or the archive; `q` searches.
export async function NotesScreen({ category, archived = false, q }: { category?: Category; archived?: boolean; q?: string }) {
  const [notes, categories] = await Promise.all([listNotes({ categoryId: category?.id, archived, q }), listCategories()]);
  const title = archived ? "Archive" : category?.name ?? "Notes";
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="hidden lg:block">{category ? <AppIcon name={category.icon} size={48} color={category.color} /> : <AppIcon name={archived ? "archive" : "notes"} size={48} />}</span>
        <h1 className="min-w-0 flex-1 truncate text-3xl font-semibold">{title}</h1>
        {category && <CategoryDialog category={category} trigger="edit" />}
        <SectionFilterButton label="Note categories" />
        <form role="search" className="relative w-full sm:w-64">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input name="q" type="search" defaultValue={q} placeholder="Search notes" aria-label="Search notes" className="input pl-10" />
        </form>
      </div>
      {!archived && <NoteComposer categoryId={category?.id ?? null} />}
      {notes.length ? (
        <NoteGrid notes={notes} categories={categories.map((c) => ({ id: c.id, name: c.name }))} showCategory={!category} />
      ) : (
        <p className="py-16 text-center text-sm text-ink-3">
          {q ? `No notes match “${q}”.` : archived ? "Archived notes show up here." : "Notes you add appear here."}
        </p>
      )}
    </div>
  );
}
