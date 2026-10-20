"use client";

import { CSSProperties, useEffect, useId, useRef, useState } from "react";
import { CheckCheck, RotateCcw, Trash2, X } from "./Icon";
import CategoryFolder from "./CategoryFolder";
import { DEFAULT_CATEGORY_COLOR } from "../lib/colors";
import { htmlToText } from "../lib/html";
import type { Category, DeletedCategory, DeletedNote, TrashSelection } from "../lib/types";
import "../app/trash-pane.css";

type Props = {
  items: DeletedNote[];
  deletedCategories: DeletedCategory[];
  categories: Category[];
  searchQuery?: string;
  onRestore: (selection: TrashSelection) => void;
  onDelete: (selection: TrashSelection) => void;
};

type Entry = { kind: "note"; value: DeletedNote } | { kind: "category"; value: DeletedCategory };
const entryKey = (entry: Entry) => entry.kind + ":" + entry.value.id;
const entryTitle = (entry: Entry) => entry.kind === "note" ? entry.value.title || "Untitled note" : entry.value.name;
const selectionFor = (entries: Entry[]): TrashSelection => ({
  noteIds: entries.filter((entry) => entry.kind === "note").map((entry) => entry.value.id),
  categoryIds: entries.filter((entry) => entry.kind === "category").map((entry) => entry.value.id),
});

function PermanentDeleteDialog({ entries, onCancel, onConfirm }: {
  entries: Entry[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const descriptionId = useId();
  const onlyNotes = entries.every((entry) => entry.kind === "note");
  const onlyCategories = entries.every((entry) => entry.kind === "category");
  const plural = onlyNotes ? "notes" : onlyCategories ? "categories" : "items";
  const singular = onlyNotes ? "note" : onlyCategories ? "category" : "item";

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return <dialog ref={dialogRef} className="trash-confirm" aria-label={"Permanently delete " + plural} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); onCancel(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onCancel();
    }}>
    <div className="trash-confirm-inner">
      <span className="trash-confirm-icon"><Trash2 size={22} /></span>
      <h2>Permanently delete {entries.length === 1 ? "this " + singular : "these " + plural}?</h2>
      <p id={descriptionId}>{entries.length === 1 ? <>“{entryTitle(entries[0])}” will be deleted permanently.</> : <>These {entries.length} {plural} will be deleted permanently.</>} This cannot be undone in Notely.{!onlyNotes && " Deleting a category permanently does not delete its notes."}</p>
      <div className="trash-confirm-actions">
        <button type="button" className="trash-cancel" autoFocus onClick={onCancel}>Cancel</button>
        <button type="button" className="trash-danger-fill" onClick={onConfirm}>Delete permanently</button>
      </div>
    </div>
  </dialog>;
}

export default function TrashPane({ items, deletedCategories, categories, searchQuery = "", onRestore, onDelete }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const entries: Entry[] = [
    ...deletedCategories.map((value): Entry => ({ kind: "category", value })),
    ...items.map((value): Entry => ({ kind: "note", value })),
  ];
  const selectedEntries = entries.filter((entry) => selected.includes(entryKey(entry)));
  const selectedSet = new Set(selectedEntries.map(entryKey));
  const pendingEntries = entries.filter((entry) => pendingDelete?.includes(entryKey(entry)));
  const isSearching = Boolean(searchQuery.trim());

  function toggleSelection(key: string) {
    setSelected((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  }
  function restore(chosen: Entry[]) {
    onRestore(selectionFor(chosen));
    const keys = new Set(chosen.map(entryKey));
    setSelected((current) => current.filter((key) => !keys.has(key)));
  }
  function confirmDelete() {
    onDelete(selectionFor(pendingEntries));
    const keys = new Set(pendingEntries.map(entryKey));
    setSelected((current) => current.filter((key) => !keys.has(key)));
    setPendingDelete(null);
  }

  function renderCard(entry: Entry) {
    const key = entryKey(entry);
    const title = entryTitle(entry);
    const isCategory = entry.kind === "category";
    const actionTitle = isCategory ? "category " + title : title;
    const deletedDate = new Date(entry.value.deletedAt);
    const validDate = !Number.isNaN(deletedDate.getTime());
    const noteCategoryId = entry.kind === "note" ? entry.value.categoryId : null;
    const category = entry.kind === "category" ? entry.value : [...categories, ...deletedCategories].find((value) => value.id === noteCategoryId);
    const color = entry.kind === "category" ? entry.value.color || DEFAULT_CATEGORY_COLOR : entry.value.background;

    return <article key={key} aria-label={"Deleted " + (isCategory ? "category " : "note ") + title}
      className={"trash-card" + (isCategory ? " trash-category-card" : "") + (selectedSet.has(key) ? " trash-card-selected" : "")}
      style={{ "--trash-note-color": color } as CSSProperties}>
      <div className="trash-card-heading">
        <label className="trash-checkbox"><input type="checkbox" checked={selectedSet.has(key)} onChange={() => toggleSelection(key)} aria-label={"Select deleted " + actionTitle} /></label>
        {isCategory && <CategoryFolder category={category} size={20} />}
        <h3 title={title}>{title}</h3>
      </div>
      {entry.kind === "note" && <p className="trash-note-preview">{htmlToText(entry.value.description) || "Empty note"}</p>}
      <div className="trash-note-meta">
        {!isCategory && <span title={category?.name || "Uncategorized"}><CategoryFolder category={category} size={13} />{category?.name || "Uncategorized"}</span>}
        {validDate && <time dateTime={deletedDate.toISOString()}>Deleted {deletedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time>}
      </div>
      <div className="trash-card-actions">
        <button type="button" className="trash-restore" aria-label={"Restore " + actionTitle} onClick={() => restore([entry])}><RotateCcw size={15} />Restore</button>
        <button type="button" className="trash-delete" aria-label={"Delete permanently " + actionTitle} onClick={() => setPendingDelete([key])}><Trash2 size={15} />Delete permanently</button>
      </div>
    </article>;
  }

  return <section className={"trash-pane" + (selectedEntries.length ? " trash-has-selection" : "")} aria-labelledby="trash-title">
    <div className="trash-pane-heading">
      <div>
        <h2 id="trash-title"><Trash2 size={22} />Trash</h2>
        <p>{isSearching ? entries.length + " matching deleted items." : entries.length ? entries.length + " deleted " + (entries.length === 1 ? "item." : "items.") + " Restore them whenever you need them." : "Your deleted notes and categories will appear here."}</p>
      </div>
      {entries.length > 0 && <button type="button" className="trash-select-all" onClick={() => setSelected(entries.map(entryKey))}><CheckCheck size={17} />Select all</button>}
    </div>
    {entries.length === 0 ? <div className="empty-state trash-empty">
      <div className="empty-art"><Trash2 size={25} /></div>
      <h3>{isSearching ? "No deleted items found" : "Trash is empty"}</h3>
      <p>{isSearching ? "Try another word or phrase." : "Deleted notes and categories stay here until you restore or permanently delete them."}</p>
    </div> : <>
      {deletedCategories.length > 0 && <section className="trash-group" aria-label="Deleted categories"><h3 className="trash-group-title">Categories</h3><div className="trash-grid">{entries.filter((entry) => entry.kind === "category").map(renderCard)}</div></section>}
      {items.length > 0 && <section className="trash-group" aria-label="Deleted notes"><h3 className="trash-group-title">Notes</h3><div className="trash-grid">{entries.filter((entry) => entry.kind === "note").map(renderCard)}</div></section>}
    </>}
    {selectedEntries.length > 0 && <div className="trash-selection-footer" role="toolbar" aria-label="Trash selection">
      <strong className="trash-selection-count" aria-live="polite">{selectedEntries.length} selected</strong>
      <div className="trash-selection-tools">
        <button type="button" onClick={() => setSelected(entries.map(entryKey))}><CheckCheck size={16} />Select all</button>
        <button type="button" className="trash-restore" onClick={() => restore(selectedEntries)}><RotateCcw size={16} />Restore selected</button>
        <button type="button" className="trash-delete" onClick={() => setPendingDelete(selectedEntries.map(entryKey))}><Trash2 size={16} />Delete permanently selected</button>
      </div>
      <button type="button" className="trash-clear-selection" aria-label="Clear selection" title="Clear selection" onClick={() => setSelected([])}><X size={17} /></button>
    </div>}
    {pendingEntries.length > 0 && <PermanentDeleteDialog entries={pendingEntries} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />}
  </section>;
}