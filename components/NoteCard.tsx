"use client";

import { CSSProperties, MouseEvent, useEffect, useRef, useState } from "react";
import { Pin, Trash2 } from "./Icon";
import { getTextColor } from "../lib/colors";
import { sanitizeHtml, toEditorHtml } from "../lib/html";
import CategoryFolder from "./CategoryFolder";
import type { Category, Note } from "../lib/types";

type Props = {
  note: Note; categories: Category[]; selected: boolean; selectionMode: boolean;
  onOpen: (note: Note) => void; onPin: (event: MouseEvent, note: Note) => void;
  onDelete: (id: number) => void; onSelect: (id: number) => void;
};
export default function NoteCard({ note, categories, selected, selectionMode, onOpen, onPin, onDelete, onSelect }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const element = bodyRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setTruncated(element.scrollHeight > element.clientHeight + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [note.title, note.description]);
  const open = () => selectionMode ? onSelect(note.id) : onOpen(note);
  const updated = new Date(note.updatedAt);
  return <div className={"note-tile" + (selected ? " note-selected" : "") + (selectionMode ? " selection-mode" : "")}>
    <label className="note-selection" title={selected ? "Deselect note" : "Select note"}><input type="checkbox" aria-label={"Select " + note.title} checked={selected} onChange={() => onSelect(note.id)} /><span aria-hidden="true" /></label>
    <article className={"note-card" + (truncated ? " truncated" : "")} style={{ background: note.background, color: getTextColor(note.background), "--note-background": note.background } as CSSProperties} role="button" tabIndex={0} aria-label={"Edit " + note.title} onClick={open} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); open(); } }}>
      <div className="preview-heading"><h3 className="preview-title" title={note.title}>{note.title}</h3><div className="preview-actions"><button className={"card-pin" + (note.pinned ? " is-pinned" : "")} aria-label={note.pinned ? "Unpin " + note.title : "Pin " + note.title} title={note.pinned ? "Unpin note" : "Pin note"} onClick={(event) => onPin(event, note)}><Pin size={15} /></button><button className="card-delete" aria-label={"Delete " + note.title} title="Delete note" onClick={(event) => { event.stopPropagation(); onDelete(note.id); }}><Trash2 size={15} /></button></div></div>
      <div className="card-body" ref={bodyRef}><div className="card-description" dangerouslySetInnerHTML={{ __html: sanitizeHtml(toEditorHtml(note.description)) }} /></div>
      <div className="card-bottom"><span className="card-category"><CategoryFolder category={categories.find((category) => category.id === note.categoryId)} size={12} />{categories.find((category) => category.id === note.categoryId)?.name || "Uncategorized"}</span><time dateTime={Number.isNaN(updated.getTime()) ? undefined : updated.toISOString()}>{Number.isNaN(updated.getTime()) ? "" : updated.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time></div>
    </article>
  </div>;
}