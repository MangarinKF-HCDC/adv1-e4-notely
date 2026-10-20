"use client";

import { MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownWideNarrow, BrandMark, ChevronLeft, ChevronRight, FileText, FolderPlus, LayoutGrid, Menu, Pin, Plus, Search, Trash2, X } from "../../components/Icon";
import { DEFAULT_CATEGORY_COLOR, getTextColor, isValidHex, normalizeHex, PRESET_COLORS } from "../../lib/colors";
import { htmlToText } from "../../lib/html";
import type { Category, DeletedCategory, DeletedNote, Note, TrashSelection } from "../../lib/types";
import NoteModal from "../../components/NoteModal";
import NoteCard from "../../components/NoteCard";
import AccountMenu from "../../components/AccountMenu";
import SelectionBar from "../../components/SelectionBar";
import DeleteCategoryDialog from "../../components/DeleteCategoryDialog";
import TrashPane from "../../components/TrashPane";
import CreateCategoryDialog from "../../components/CreateCategoryDialog";
import CategoryFolder from "../../components/CategoryFolder";
import { createStarterNote } from "../../lib/defaults";
import { restoreTrashItems } from "../../lib/trash";
import "../workspace-updates.css";
import "../motion-updates.css";

const defaultCategories: Category[] = [];

export default function NotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [trash, setTrash] = useState<DeletedNote[]>([]);
  const [deletedCategories, setDeletedCategories] = useState<DeletedCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [email, setEmail] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | "all" | "pinned" | "trash">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [theme, setTheme] = useState("light");
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [greeting, setGreeting] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("isLoggedIn") !== "true") { router.replace("/"); return; }
    const parse = (key: string, fallback: unknown) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
    // Restore browser storage once after hydration, before persistence effects run.
    /* eslint-disable react-hooks/set-state-in-effect */
    setEmail(sessionStorage.getItem("userEmail") || "friend@gmail.com");
    const hasSavedWorkspace = localStorage.getItem("notely-notes") !== null || localStorage.getItem("notely-trash") !== null || localStorage.getItem("notely-trash-categories") !== null;
    const storedNotes = parse("notely-notes", hasSavedWorkspace ? [] : [createStarterNote()]);
    setNotes(Array.isArray(storedNotes) ? storedNotes.filter((note) => note && typeof note.title === "string" && typeof note.description === "string").map((note) => ({ ...note, background: isValidHex(note.background || "") ? normalizeHex(note.background) : "#FFD9B8" })) : []);
    const storedTrash = parse("notely-trash", []);
    setTrash(Array.isArray(storedTrash) ? storedTrash.filter((note) => note && typeof note.title === "string" && typeof note.description === "string").map((note) => ({ ...note, deletedAt: typeof note.deletedAt === "number" ? note.deletedAt : Date.now(), background: isValidHex(note.background || "") ? normalizeHex(note.background) : "#FFD9B8" })) : []);
    const storedCategories = parse("notely-categories", defaultCategories);
    setCategories(Array.isArray(storedCategories) ? storedCategories.filter((category) => category && typeof category.id === "number" && category.id !== 0 && typeof category.name === "string").map((category, index) => ({ ...category, color: typeof category.color === "string" && isValidHex(category.color) ? normalizeHex(category.color) : PRESET_COLORS[index % PRESET_COLORS.length].hex })) : defaultCategories);
    const storedDeletedCategories = parse("notely-trash-categories", []);
    setDeletedCategories(Array.isArray(storedDeletedCategories) ? storedDeletedCategories.filter((category) => category && typeof category.id === "number" && category.id !== 0 && typeof category.name === "string").map((category) => ({
      ...category,
      color: typeof category.color === "string" && isValidHex(category.color) ? normalizeHex(category.color) : DEFAULT_CATEGORY_COLOR,
      deletedAt: typeof category.deletedAt === "number" ? category.deletedAt : Date.now(),
      noteIds: Array.isArray(category.noteIds) ? category.noteIds.filter((id: unknown) => typeof id === "number") : [],
    })) : []);
    const storedColors = parse("notely-recent-colors", []);
    setRecentColors(Array.isArray(storedColors) ? [...new Set(storedColors.filter((color) => typeof color === "string" && isValidHex(color)).map(normalizeHex))].slice(0, 6) : []);
    setTheme(localStorage.getItem("notely-theme") === "dark" ? "dark" : "light");
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [router]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("notely-notes", JSON.stringify(notes));
    localStorage.setItem("notely-trash", JSON.stringify(trash));
    localStorage.setItem("notely-trash-categories", JSON.stringify(deletedCategories));
    localStorage.setItem("notely-categories", JSON.stringify(categories));
    localStorage.setItem("notely-recent-colors", JSON.stringify(recentColors));
  }, [notes, trash, deletedCategories, categories, recentColors, loaded]);
  useEffect(() => {
    if (!loaded) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("notely-theme", theme);
  }, [theme, loaded]);
  useEffect(() => {
    const update = () => {
      const hour = new Date().getHours();
      setGreeting(hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 18 ? "Good afternoon" : hour >= 18 && hour < 22 ? "Good evening" : "Good evening");
    };
    update(); const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedIds.length || modalOpen || categoryToDelete || addingCategory) return;
    const clear = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedIds([]); };
    window.addEventListener("keydown", clear); return () => window.removeEventListener("keydown", clear);
  }, [selectedIds.length, modalOpen, categoryToDelete, addingCategory]);

  const filtered = useMemo(() => notes.filter((note) => activeCategory !== "trash" && (activeCategory === "all" || (activeCategory === "pinned" ? note.pinned : note.categoryId === activeCategory)) && (note.title + " " + htmlToText(note.description)).toLowerCase().includes(searchQuery.toLowerCase())).sort((a, b) => b.updatedAt - a.updatedAt), [notes, activeCategory, searchQuery]);
  const filteredTrash = useMemo(() => trash.filter((note) => (note.title + " " + htmlToText(note.description)).toLowerCase().includes(searchQuery.toLowerCase())).sort((a, b) => b.deletedAt - a.deletedAt), [trash, searchQuery]);
  const filteredDeletedCategories = useMemo(() => deletedCategories.filter((category) => category.name.toLowerCase().includes(searchQuery.toLowerCase())).sort((a, b) => b.deletedAt - a.deletedAt), [deletedCategories, searchQuery]);
  const pinned = filtered.filter((note) => note.pinned);
  const regular = filtered.filter((note) => !note.pinned);
  const selectionMode = selectedIds.length > 0;
  const countCategory = (id: number) => notes.filter((note) => note.categoryId === id).length;
  const closeModal = useCallback(() => setModalOpen(false), []);
  function createNote() { if (activeCategory === "trash") { setActiveCategory("all"); setSearchQuery(""); } setSelectedNote(null); setModalOpen(true); setSidebarOpen(false); }
  function editNote(note: Note) { setSelectedNote(note); setModalOpen(true); }
  function saveNote(note: Note) { if (selectedNote && selectedNote.categoryId !== note.categoryId) forgetCategoryMembership([note.id]); setNotes((previous) => selectedNote ? previous.map((item) => item.id === selectedNote.id ? note : item) : [note, ...previous]); closeModal(); }
  function moveToTrash(ids: number[]) {
    const deletedAt = Date.now();
    const deleted = notes.filter((note) => ids.includes(note.id)).map((note) => ({ ...note, deletedAt }));
    if (!deleted.length) return;
    setTrash((previous) => [...deleted, ...previous.filter((note) => !ids.includes(note.id))]);
    setNotes((previous) => previous.filter((note) => !ids.includes(note.id)));
    setSelectedIds((previous) => previous.filter((id) => !ids.includes(id)));
    closeModal();
  }
  function deleteNote(id: number) { moveToTrash([id]); }
  function restoreTrash(selection: TrashSelection) {
    const restored = restoreTrashItems({ notes, categories, trash, deletedCategories }, selection);
    setNotes(restored.notes);
    setCategories(restored.categories);
    setTrash(restored.trash);
    setDeletedCategories(restored.deletedCategories);
  }
  function permanentlyDeleteTrash(selection: TrashSelection) {
    setTrash((previous) => previous.filter((note) => !selection.noteIds.includes(note.id)).map((note) => selection.categoryIds.includes(note.categoryId) ? { ...note, categoryId: 0 } : note));
    setDeletedCategories((previous) => previous.filter((category) => !selection.categoryIds.includes(category.id)).map((category) => ({ ...category, noteIds: category.noteIds.filter((id) => !selection.noteIds.includes(id)) })));
  }
  function forgetCategoryMembership(ids: number[]) {
    setDeletedCategories((previous) => previous.map((category) => ({ ...category, noteIds: category.noteIds.filter((id) => !ids.includes(id)) })));
  }
  function pinNote(event: MouseEvent, note: Note) { event.stopPropagation(); setNotes((previous) => previous.map((item) => item.id === note.id ? { ...item, pinned: !item.pinned, updatedAt: Date.now() } : item)); }
  function navigate(category: number | "all" | "pinned" | "trash") { setActiveCategory(category); setSidebarOpen(false); setSelectedIds([]); setSearchQuery(""); setAddingCategory(false); }
  function newCategory() { setAddingCategory(true); setSidebarOpen(false); }
  const closeCreateCategory = useCallback(() => setAddingCategory(false), []);
  function saveCategory(name: string, color: string) {
    setCategories((previous) => [...previous, { id: Date.now(), name, color }]);
    setAddingCategory(false);
  }
  function toggleSelection(id: number) { setSelectedIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]); }
  function batchPin(value: boolean) { setNotes((previous) => previous.map((note) => selectedIds.includes(note.id) ? { ...note, pinned: value, updatedAt: Date.now() } : note)); }
  function batchMove(categoryId: number) { forgetCategoryMembership(selectedIds); setNotes((previous) => previous.map((note) => selectedIds.includes(note.id) ? { ...note, categoryId, updatedAt: Date.now() } : note)); }
  function batchDelete() { moveToTrash(selectedIds); setSelectedIds([]); }
  const closeCategoryDialog = useCallback(() => setCategoryToDelete(null), []);
  function deleteCategory() {
    if (!categoryToDelete) return;
    const id = categoryToDelete.id;
    const noteIds = [...new Set([...notes, ...trash].filter((note) => note.categoryId === id).map((note) => note.id))];
    const deleted: DeletedCategory = { ...categoryToDelete, deletedAt: Date.now(), noteIds };
    setDeletedCategories((previous) => [deleted, ...previous.filter((category) => category.id !== id).map((category) => ({ ...category, noteIds: category.noteIds.filter((noteId) => !noteIds.includes(noteId)) }))]);
    setCategories((previous) => previous.filter((category) => category.id !== id));
    setNotes((previous) => previous.map((note) => note.categoryId === id ? { ...note, categoryId: 0 } : note));
    if (activeCategory === id) setActiveCategory("all");
    setCategoryToDelete(null);
  }
  function logout() { sessionStorage.removeItem("isLoggedIn"); sessionStorage.removeItem("userEmail"); router.push("/"); }

  if (!loaded) return <main className="workspace-loading" aria-label="Loading notes"><BrandMark /></main>;
  const name = email.split("@")[0];
  const sectionName = activeCategory === "all" ? "All notes" : categories.find((category) => category.id === activeCategory)?.name || (activeCategory === 0 ? "Uncategorized" : "Notes");
  return <div className={"workspace" + (selectionMode ? " has-selection" : "")}>
    <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu size={20} /></button><Link className="brand header-brand" href="/notes"><BrandMark /><span>notely</span></Link>
      <div className="topbar-right"><div className={"search-box" + (isSearchOpen ? " open" : "")}>{isSearchOpen && <input autoFocus aria-label={activeCategory === "trash" ? "Search trash" : "Search notes"} placeholder={activeCategory === "trash" ? "Search trash..." : "Search your notes..."} value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSelectedIds([]); }} onKeyDown={(event) => { if (event.key === "Escape") { setSearchQuery(""); setSearchOpen(false); } }} />}<button className="icon-button" aria-label={isSearchOpen ? "Close search" : "Search"} onClick={() => { setSearchOpen(!isSearchOpen); setSearchQuery(""); }}>{isSearchOpen ? <X size={18} /> : <Search size={18} />}</button></div>
        <AccountMenu email={email} theme={theme} onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")} onLogout={logout} />
      </div>
    </header>
    <div className="app-body">
      <aside className={"sidebar" + (collapsed ? " collapsed" : "") + (sidebarOpen ? " mobile-open" : "")}>
        <div className="sidebar-actions">
          <button className="create-button" aria-label="Create note" title="Create note" onClick={createNote}><Plus size={18} /><span>Create note</span></button>
          <button className="sidebar-toggle" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button>
        </div>
        <nav className="nav-group" aria-label="Notes navigation"><button className={"nav-item" + (activeCategory === "all" ? " active" : "")} title="All notes" onClick={() => navigate("all")}><LayoutGrid size={18} /><span>All notes</span><b>{notes.length}</b></button><button className={"nav-item" + (activeCategory === "pinned" ? " active" : "")} title="Pinned" onClick={() => navigate("pinned")}><Pin size={18} /><span>Pinned</span><b>{notes.filter((note) => note.pinned).length}</b></button></nav>
        <div className="sidebar-section-title"><span>YOUR CATEGORIES</span><button type="button" className="tiny-icon" aria-label="Add category" title="Add category" onClick={newCategory}><Plus size={15} /></button></div>
        <div className="category-list"><div className="category-nav-row default-category-row"><button className={"nav-item default-category" + (activeCategory === 0 ? " active" : "")} title="Uncategorized" onClick={() => navigate(0)}><CategoryFolder size={17} /><span>Uncategorized</span><b>{countCategory(0)}</b></button></div>{categories.map((category) => <div key={category.id} className="category-nav-row"><button className={"nav-item" + (activeCategory === category.id ? " active" : "")} title={category.name} onClick={() => navigate(category.id)}><CategoryFolder category={category} size={17} /><span>{category.name}</span><b>{countCategory(category.id)}</b></button><button type="button" className="delete-category" aria-label={"Delete category " + category.name} title={"Delete category " + category.name} onClick={() => setCategoryToDelete(category)}><Trash2 size={14} /></button></div>)}
        </div>
        <div className="sidebar-trash"><button className={"nav-item" + (activeCategory === "trash" ? " active" : "")} aria-label="Trash" title="Trash" onClick={() => navigate("trash")}><Trash2 size={18} /><span>Trash</span><b>{trash.length + deletedCategories.length}</b></button></div>
      </aside>
      <button className={"sidebar-overlay" + (sidebarOpen ? " open" : "")} aria-label="Close menu" aria-hidden={!sidebarOpen} tabIndex={sidebarOpen ? 0 : -1} disabled={!sidebarOpen} onClick={() => setSidebarOpen(false)} />
      <main className="main-content">
        {activeCategory === "trash" ? <TrashPane key={searchQuery} searchQuery={searchQuery} items={filteredTrash} deletedCategories={filteredDeletedCategories} categories={[...categories, ...deletedCategories]} onRestore={restoreTrash} onDelete={permanentlyDeleteTrash} /> : <>
        <div className="welcome-row"><div><h1>{greeting ? greeting + ", " + name + "!" : ""}</h1><p className="welcome-sub">What&apos;s on your mind?</p></div><button className="create-inline" onClick={createNote}><Plus size={17} />New note</button></div>
        <div className="section-heading"><h2>Categories</h2><button className="text-action" onClick={newCategory}><FolderPlus size={16} /><span>New category</span></button></div>
        <div className="category-row"><button className={"category-chip" + (activeCategory === "all" ? " chosen" : "")} onClick={() => navigate("all")}><span className="category-symbol"><LayoutGrid size={16} /></span><span>All notes</span><b>{notes.length}</b></button><button className={"category-chip fixed-category" + (activeCategory === 0 ? " chosen" : "")} onClick={() => navigate(0)}><span className="category-symbol"><CategoryFolder size={16} /></span><span>Uncategorized</span><b>{countCategory(0)}</b></button>{categories.map((category) => <button key={category.id} className={"category-chip" + (activeCategory === category.id ? " chosen" : "")} onClick={() => navigate(category.id)}><span className="category-symbol" style={{ background: category.color, color: getTextColor(category.color || "#FFD9B8") }}><CategoryFolder category={category} size={16} /></span><span>{category.name}</span><b>{countCategory(category.id)}</b></button>)}<button className="add-category-chip" aria-label="New category" onClick={newCategory}><Plus size={19} /></button></div>
        {pinned.length > 0 && <section><div className="section-heading notes-heading"><h2><Pin size={17} className="section-pin" />Pinned</h2><span className="result-count">{pinned.length} {pinned.length === 1 ? "note" : "notes"}</span></div><div className="note-grid">{pinned.map((note) => <NoteCard key={note.id} note={note} categories={categories} onOpen={editNote} onPin={pinNote} onDelete={deleteNote} selected={selectedIds.includes(note.id)} selectionMode={selectionMode} onSelect={toggleSelection} />)}</div></section>}
        {activeCategory !== "pinned" && <section><div className="section-heading notes-heading"><h2>{sectionName}</h2><div className="list-controls"><ArrowDownWideNarrow size={14} /><span>Newest first</span><span className="result-count">{regular.length} {regular.length === 1 ? "note" : "notes"}</span></div></div><div className="note-grid">{regular.map((note) => <NoteCard key={note.id} note={note} categories={categories} onOpen={editNote} onPin={pinNote} onDelete={deleteNote} selected={selectedIds.includes(note.id)} selectionMode={selectionMode} onSelect={toggleSelection} />)}</div></section>}
        {filtered.length === 0 && <div className="empty-state"><div className="empty-art"><span /><span /><FileText size={29} /></div><h3>{searchQuery ? "No notes found" : activeCategory === "pinned" ? "No pinned notes yet" : "No notes yet"}</h3><p>{searchQuery ? "Try another word or phrase." : activeCategory === "pinned" ? "Pin a note to keep it close." : "Create your first one."}</p>{!searchQuery && activeCategory !== "pinned" && <button className="create-inline" onClick={createNote}><Plus size={17} />Create your first note</button>}</div>}
        </>}
      </main>
    </div>
    {selectionMode && !modalOpen && <SelectionBar count={selectedIds.length} categories={categories} onSelectAll={() => setSelectedIds(filtered.map((note) => note.id))} onClear={() => setSelectedIds([])} onPin={batchPin} onMove={batchMove} onDelete={batchDelete} />}
    {addingCategory && <CreateCategoryDialog existingNames={["Uncategorized", ...categories.map((category) => category.name)]} onCreate={saveCategory} onClose={closeCreateCategory} />}
    {categoryToDelete && <DeleteCategoryDialog category={categoryToDelete} noteCount={countCategory(categoryToDelete.id)} onClose={closeCategoryDialog} onDelete={deleteCategory} />}
    {modalOpen && <NoteModal note={selectedNote} categories={categories} initialCategoryId={typeof activeCategory === "number" ? activeCategory : 0} initialBackground={typeof activeCategory === "number" ? categories.find((category) => category.id === activeCategory)?.color || DEFAULT_CATEGORY_COLOR : "#FFFFFF"} recentColors={recentColors} onRecentColors={setRecentColors} onSave={saveNote} onDelete={deleteNote} onClose={closeModal} />}
  </div>;
}
