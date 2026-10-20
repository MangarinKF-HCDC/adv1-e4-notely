import type { Category, DeletedCategory, DeletedNote, Note, TrashSelection } from "./types";

type State = {
  notes: Note[];
  categories: Category[];
  trash: DeletedNote[];
  deletedCategories: DeletedCategory[];
};

export function restoreTrashItems(state: State, selection: TrashSelection): State {
  const names = new Set(["uncategorized", ...state.categories.map((category) => category.name.toLowerCase())]);
  const ids = new Set(state.categories.map((category) => category.id));
  const restoredCategories: Category[] = [];
  const categoryIds = new Map<number, number>();
  const memberships = new Map<number, number>();

  const selectedCategories = state.deletedCategories.filter((category) => selection.categoryIds.includes(category.id)).sort((a, b) => b.deletedAt - a.deletedAt);
  for (const deleted of selectedCategories) {
    let name = deleted.name;
    let suffix = 1;
    while (names.has(name.toLowerCase())) {
      name = deleted.name + (suffix === 1 ? " (restored)" : " (restored " + suffix + ")");
      suffix += 1;
    }
    names.add(name.toLowerCase());
    let id = deleted.id;
    if (ids.has(id)) {
      id = Date.now();
      while (ids.has(id) || id === 0) id += 1;
    }
    ids.add(id);
    categoryIds.set(deleted.id, id);
    restoredCategories.push({ id, name, color: deleted.color, ...(deleted.pinned === undefined ? {} : { pinned: deleted.pinned }) });
    for (const noteId of deleted.noteIds) if (!memberships.has(noteId)) memberships.set(noteId, id);
  }

  const validCategoryIds = new Set([0, ...ids]);
  const activeNoteIds = new Set(state.notes.map((note) => note.id));
  const resolveCategory = (note: Note) => note.categoryId === 0 && memberships.has(note.id)
    ? memberships.get(note.id)!
    : categoryIds.get(note.categoryId) ?? note.categoryId;
  const restoredNotes: Note[] = state.trash.filter((note) => selection.noteIds.includes(note.id) && !activeNoteIds.has(note.id)).map((note) => {
    const categoryId = resolveCategory(note);
    return {
      id: note.id, title: note.title, description: note.description,
      categoryId: validCategoryIds.has(categoryId) ? categoryId : 0,
      background: note.background, pinned: note.pinned, updatedAt: note.updatedAt,
    };
  });

  return {
    categories: [...state.categories, ...restoredCategories],
    notes: [...restoredNotes, ...state.notes.map((note) => note.categoryId === 0 && memberships.has(note.id) ? { ...note, categoryId: memberships.get(note.id)! } : note)],
    trash: state.trash.filter((note) => !selection.noteIds.includes(note.id)).map((note) => ({ ...note, categoryId: resolveCategory(note) })),
    deletedCategories: state.deletedCategories.filter((category) => !selection.categoryIds.includes(category.id)),
  };
}