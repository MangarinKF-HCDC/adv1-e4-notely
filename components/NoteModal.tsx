"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Check, Maximize2, Minimize2, Palette, Pin, Trash2, X } from "./Icon";
import { getTextColor, isValidHex, normalizeHex, PRESET_COLORS } from "../lib/colors";
import { sanitizeHtml, toEditorHtml } from "../lib/html";
import type { Category, Note } from "../lib/types";
import RichTextToolbar from "./RichTextToolbar";
import "../app/editor-updates.css";

const FontSize = Extension.create({
  name: "notelyFontSize",
  addGlobalAttributes() {
    return [{ types: ["textStyle"], attributes: { fontSize: {
      default: null,
      parseHTML: (element) => element.style.fontSize || null,
      renderHTML: (attributes) => attributes.fontSize ? { style: "font-size: " + attributes.fontSize } : {},
    } } }];
  },
});
const LetteredList = Extension.create({
  name: "letteredList",
  addGlobalAttributes() {
    return [{ types: ["orderedList"], attributes: { listStyle: {
      default: "decimal",
      parseHTML: (element) => element.getAttribute("type") === "a" || element.style.listStyleType === "lower-alpha" ? "lower-alpha" : "decimal",
      renderHTML: (attributes) => attributes.listStyle === "lower-alpha" ? { type: "a", style: "list-style-type: lower-alpha" } : {},
    } } }];
  },
});

function hasEmptyParagraph(editor: Editor) {
  const { doc } = editor.state;
  const firstBlock = doc.firstChild;
  return doc.childCount === 1 && firstBlock?.type.name === "paragraph" && firstBlock.content.size === 0;
}
type Props = {
  note: Note | null; categories: Category[]; initialCategoryId: number; initialBackground: string; recentColors: string[];
  onRecentColors: (colors: string[]) => void; onSave: (note: Note) => void;
  onDelete: (id: number) => void; onClose: () => void;
};

export default function NoteModal({ note, categories, initialCategoryId, initialBackground, recentColors, onRecentColors, onSave, onDelete, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const colorPanelRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(note?.title || "");
  const [categoryId, setCategoryId] = useState(note?.categoryId ?? initialCategoryId);
  const [background, setBackground] = useState(note?.background ?? initialBackground);
  const [hexInput, setHexInput] = useState(note?.background ?? initialBackground);
  const [hexError, setHexError] = useState("");
  const [pinned, setPinned] = useState(note?.pinned || false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [customColorsOpen, setCustomColorsOpen] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [showDescriptionPlaceholder, setShowDescriptionPlaceholder] = useState(!note?.description);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ underline: false, link: false, heading: false, codeBlock: false, horizontalRule: false, code: false, trailingNode: false }),
      Underline, TextAlign.configure({ types: ["paragraph", "heading"] }), TextStyle, FontSize, LetteredList,
      TaskList, TaskItem.configure({ nested: true, HTMLAttributes: { "data-type": "taskItem" }, a11y: { checkboxLabel: (node) => "Complete task: " + (node.textContent || "Untitled task") } }),
    ],
    content: toEditorHtml(note?.description || ""),
    editorProps: { attributes: { class: "note-rich-content", role: "textbox", "aria-label": "Description", "aria-multiline": "true" } },
    onCreate: ({ editor }) => setShowDescriptionPlaceholder(hasEmptyParagraph(editor)),
    onUpdate: ({ editor }) => setShowDescriptionPlaceholder(hasEmptyParagraph(editor)),
  });

  useEffect(() => {
    const priorFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    titleRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "Tab") {
        const controls = formRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, [contenteditable="true"]');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = previousOverflow; priorFocus?.focus(); };
  }, [onClose]);

  useEffect(() => {
    if (!customColorsOpen) return;
    const outside = (event: MouseEvent) => {
      if (!colorPanelRef.current?.contains(event.target as Node)) setCustomColorsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); setCustomColorsOpen(false); }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape, true); };
  }, [customColorsOpen]);

  function rememberColor(color: string) {
    onRecentColors([color, ...recentColors.filter((item) => item.toUpperCase() !== color.toUpperCase())].slice(0, 6));
  }
  function chooseColor(color: string) { const next = normalizeHex(color); setBackground(next); setHexInput(next); setHexError(""); }
  function typeHex(raw: string) {
    const value = "#" + raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    setHexInput(value); setHexError("");
    if (isValidHex(value)) setBackground(normalizeHex(value));
  }
  function commitHex() {
    if (!isValidHex(hexInput)) { setHexError("Enter a valid hex, such as #FFD9B8."); return; }
    const next = normalizeHex(hexInput); setHexInput(next); setBackground(next); setHexError(""); rememberColor(next);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) { setTitleError("Title is required."); titleRef.current?.focus(); return; }
    onSave({ id: note?.id || Date.now(), title: title.trim(), description: sanitizeHtml(editor?.getHTML() || ""), categoryId, background, pinned, updatedAt: Date.now() });
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form ref={formRef} className={"note-modal" + (isExpanded ? " expanded" : "")} role="dialog" aria-modal="true" aria-label={note ? "Edit note" : "Create note"} style={{ background, color: getTextColor(background) }} onSubmit={save}>
      <div className="modal-topbar"><div className="modal-actions">
        <button type="button" className={"modal-icon" + (pinned ? " pinned" : "")} aria-label={pinned ? "Unpin note" : "Pin note"} aria-pressed={pinned} title={pinned ? "Unpin note" : "Pin note"} onClick={() => setPinned(!pinned)}><Pin size={18} /></button>
        <button type="button" className="modal-icon" aria-label={isExpanded ? "Exit full screen" : "Full screen"} title={isExpanded ? "Exit full screen" : "Full screen"} aria-pressed={isExpanded} onMouseDown={(event) => event.preventDefault()} onClick={() => { setIsExpanded(!isExpanded); setCustomColorsOpen(false); }}>{isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
        <button type="button" className="modal-icon" aria-label="Close note" title="Close" onClick={onClose}><X size={20} /></button>
      </div></div>
      <div className="modal-main">
        <input ref={titleRef} className="modal-title" aria-label="Title" placeholder="Title" value={title} onChange={(event) => { setTitle(event.target.value); setTitleError(""); }} />
        <div className={"title-error" + (titleError ? " visible" : "")} role="alert">{titleError}</div>
        <div className="description-editor">{showDescriptionPlaceholder && <span className="editor-placeholder">Description</span>}<EditorContent editor={editor} /></div>
        <div className="editor-options">
        <RichTextToolbar editor={editor} />
        <div ref={colorPanelRef} className="modal-color-panel">
          <div className="preset-row" aria-label="Note colors">{PRESET_COLORS.map((color) => <button type="button" key={color.hex} className={"color-swatch" + (color.hex === background ? " selected" : "")} style={{ background: color.hex }} aria-label={color.name} title={color.name} aria-pressed={color.hex === background} onClick={() => chooseColor(color.hex)} />)}</div>
          <button type="button" className="custom-colors-toggle" aria-label="Custom colors" title="Custom colors and recent colors" aria-expanded={customColorsOpen} onClick={() => setCustomColorsOpen(!customColorsOpen)}><Palette size={17} /></button>
          <div className={"extra-color-controls" + (customColorsOpen ? " open" : "")}>
          {recentColors.length > 0 && <div className="recent-row"><span>Recent</span>{recentColors.map((color) => <button type="button" key={color} className={"color-swatch" + (color.toUpperCase() === background.toUpperCase() ? " selected" : "")} style={{ background: color }} aria-label={"Recent " + color} onClick={() => chooseColor(color)} />)}</div>}
          <div className="custom-color-row"><label htmlFor="hex-color">HEX</label><input id="hex-color" aria-label="Custom hex" value={hexInput} maxLength={7} spellCheck={false} onChange={(event) => typeHex(event.target.value)} onBlur={commitHex} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitHex(); } }} />
            <label className="color-wheel" title="Choose custom color"><Palette size={16} /><input type="color" aria-label="Color wheel" value={normalizeHex(background).toLowerCase()} onChange={(event) => { chooseColor(event.target.value); rememberColor(event.target.value.toUpperCase()); }} /></label>
          </div>
          <div className="hex-error" role="alert">{hexError}</div>
          </div>
        </div>
        </div>
      </div>
      <footer className="modal-footer"><select aria-label="Category" value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))}><option value={0}>Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <div className="modal-footer-actions">{note && <button className="delete-note" type="button" aria-label="Delete" title="Delete note" onClick={() => onDelete(note.id)}><Trash2 size={15} /><span>Delete</span></button>}<button className="cancel-button" type="button" onClick={onClose}>Cancel</button><button className="save-button" type="submit"><Check size={16} />Save</button></div>
      </footer>
    </form>
  </div>;
}
