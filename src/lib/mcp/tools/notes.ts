import "server-only";
import { z } from "zod";
import { NOTE_COLORS } from "@/db/schema";
import { createCategory, createNote, deleteCategory, deleteNote, listCategories, listNotes, updateCategory, updateNote } from "@/lib/core/notes";
import { GROUP_ICONS } from "@/lib/group-icons";
import { id, tool } from "./shared";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/).describe("Hex colour, e.g. #7262ea");
const items = z.array(z.object({ text: z.string(), done: z.boolean() })).describe("Checklist items");

export const noteTools = [
  tool({
    name: "list_note_categories",
    description: "List note categories.",
    input: z.object({}),
    run: async () => (await listCategories()).map(({ id, name, color, icon }) => ({ id, name, color, icon })),
  }),
  tool({
    name: "create_note_category",
    description: "Create a note category.",
    write: true,
    input: z.object({ name: z.string(), color: color.optional(), icon: z.enum(GROUP_ICONS).optional() }),
    run: (args) => createCategory(args),
  }),
  tool({
    name: "update_note_category",
    description: "Rename a note category or change its colour or icon.",
    write: true,
    input: z.object({ id: id("Note category"), name: z.string().optional(), color: color.optional(), icon: z.enum(GROUP_ICONS).optional() }),
    run: ({ id, ...patch }) => updateCategory(id, patch),
  }),
  tool({
    name: "delete_note_category",
    description: "Delete a note category. Its notes are kept and become uncategorised.",
    write: true,
    input: z.object({ id: id("Note category") }),
    run: ({ id }) => deleteCategory(id),
  }),
  tool({
    name: "list_notes",
    description: "List or search notes (Keep-style: title, text and/or a checklist). Pinned first.",
    input: z.object({
      q: z.string().optional().describe("Search title, text and checklist items"),
      categoryId: id("Note category").optional(),
      archived: z.boolean().default(false).describe("List the archive instead"),
    }),
    run: async (f) =>
      (await listNotes(f)).map(({ id, title, body, items, color, pinned, categoryName, updatedAt }) => ({ id, title, body, items, color, pinned, category: categoryName, updatedAt })),
  }),
  tool({
    name: "create_note",
    description: "Create a note with a title, text and/or checklist items.",
    write: true,
    input: z.object({
      title: z.string().optional(),
      body: z.string().optional(),
      items: items.optional(),
      categoryId: id("Note category").optional(),
      color: z.enum(NOTE_COLORS).optional(),
      pinned: z.boolean().optional(),
    }),
    run: (args) => createNote(args),
  }),
  tool({
    name: "update_note",
    description: "Edit a note. Fields left out are unchanged; `items` replaces the whole checklist. Set archived to archive it.",
    write: true,
    input: z.object({
      id: id("Note"),
      title: z.string().optional(),
      body: z.string().optional(),
      items: items.nullable().optional(),
      categoryId: id("Note category").nullable().optional(),
      color: z.enum(NOTE_COLORS).optional(),
      pinned: z.boolean().optional(),
      archived: z.boolean().optional(),
    }),
    run: ({ id, ...patch }) => updateNote(id, patch),
  }),
  tool({
    name: "delete_note",
    description: "Permanently delete a note. Prefer update_note with archived: true unless asked to delete.",
    write: true,
    input: z.object({ id: id("Note") }),
    run: ({ id }) => deleteNote(id),
  }),
];
