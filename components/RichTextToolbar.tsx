"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, CheckSquare, ChevronDown, Italic, List, ListOrdered, Strikethrough, Type, Underline } from "./Icon";

export default function RichTextToolbar({ editor }: { editor: Editor | null }) {
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editor) return;
    const update = () => refresh();
    editor.on("transaction", update); editor.on("selectionUpdate", update);
    return () => { editor.off("transaction", update); editor.off("selectionUpdate", update); };
  }, [editor]);
  useEffect(() => {
    if (!fontSizeOpen) return;
    const outside = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setFontSizeOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); setFontSizeOpen(false); } };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape, true); };
  }, [fontSizeOpen]);

  function orderedList(style: "decimal" | "lower-alpha") {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (!editor.isActive("orderedList")) chain.toggleOrderedList().updateAttributes("orderedList", { listStyle: style, type: style === "lower-alpha" ? "a" : null }).run();
    else if (editor.getAttributes("orderedList").listStyle === style) chain.toggleOrderedList().run();
    else chain.updateAttributes("orderedList", { listStyle: style, type: style === "lower-alpha" ? "a" : null }).run();
  }
  if (!editor) return <div className="rich-toolbar" />;
  const buttons = [
    { label: "Bold", Icon: Bold, active: editor.isActive("bold"), click: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", Icon: Italic, active: editor.isActive("italic"), click: () => editor.chain().focus().toggleItalic().run() },
    { label: "Underline", Icon: Underline, active: editor.isActive("underline"), click: () => editor.chain().focus().toggleUnderline().run() },
    { label: "Strikethrough", Icon: Strikethrough, active: editor.isActive("strike"), click: () => editor.chain().focus().toggleStrike().run() },
  ];
  const alignment = [
    { label: "Align left", value: "left", Icon: AlignLeft },
    { label: "Align center", value: "center", Icon: AlignCenter },
    { label: "Align right", value: "right", Icon: AlignRight },
    { label: "Justify", value: "justify", Icon: AlignJustify },
  ];
  return <div className="rich-toolbar" role="toolbar" aria-label="Text formatting">
    <div className="tool-group">{buttons.map(({ label, Icon, active, click }) => <button key={label} type="button" title={label} aria-label={label} aria-pressed={active} className={"tool-button" + (active ? " active" : "")} onMouseDown={(event) => event.preventDefault()} onClick={click}><Icon size={16} /></button>)}</div>
    <span className="tool-divider" />
    <div className="font-size-control" ref={menuRef}><button type="button" title="Font size" aria-label="Font size" aria-expanded={fontSizeOpen} className={"tool-button" + (fontSizeOpen ? " active" : "")} onMouseDown={(event) => event.preventDefault()} onClick={() => setFontSizeOpen(!fontSizeOpen)}><Type size={16} /><ChevronDown size={10} /></button>
      {fontSizeOpen && <div className="font-size-menu" role="menu" aria-label="Font sizes">{[14, 16, 18, 20, 24, 32].map((size) => <button key={size} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => { editor.chain().focus().setMark("textStyle", { fontSize: size + "px" }).run(); setFontSizeOpen(false); }}>{size}</button>)}</div>}
    </div>
    <span className="tool-divider" />
    <div className="tool-group">{alignment.map(({ label, value, Icon }) => <button key={value} type="button" aria-label={label} title={label} aria-pressed={editor.isActive({ textAlign: value })} className={"tool-button" + (editor.isActive({ textAlign: value }) ? " active" : "")} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().setTextAlign(value).run()}><Icon size={16} /></button>)}</div>
    <span className="tool-divider" />
    <div className="tool-group"><button type="button" className={"tool-button" + (editor.isActive("bulletList") ? " active" : "")} aria-label="Bullets" title="Bullets" aria-pressed={editor.isActive("bulletList")} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></button>
      <button type="button" className={"tool-button" + (editor.isActive("orderedList", { listStyle: "decimal" }) ? " active" : "")} aria-label="Numbers" title="Numbers" aria-pressed={editor.isActive("orderedList", { listStyle: "decimal" })} onMouseDown={(event) => event.preventDefault()} onClick={() => orderedList("decimal")}><ListOrdered size={16} /></button>
      <button type="button" className={"tool-button letter-list" + (editor.isActive("orderedList", { listStyle: "lower-alpha" }) ? " active" : "")} aria-label="Letters" title="Letters" aria-pressed={editor.isActive("orderedList", { listStyle: "lower-alpha" })} onMouseDown={(event) => event.preventDefault()} onClick={() => orderedList("lower-alpha")}>a.</button>
      <button type="button" className={"tool-button" + (editor.isActive("taskList") ? " active" : "")} aria-label="Checklist" title="Checklist" aria-pressed={editor.isActive("taskList")} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().toggleTaskList().run()}><CheckSquare size={16} /></button></div>
  </div>;
}
