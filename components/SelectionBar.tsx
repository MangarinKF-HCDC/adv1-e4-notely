"use client";

import { CheckCheck, Pin, PinOff, Trash2, X } from "./Icon";
import type { Category } from "../lib/types";

export default function SelectionBar({ count, categories, onSelectAll, onClear, onPin, onMove, onDelete }: {
  count: number; categories: Category[]; onSelectAll: () => void; onClear: () => void;
  onPin: (value: boolean) => void; onMove: (categoryId: number) => void; onDelete: () => void;
}) {
  return <div className="selection-footer" role="toolbar" aria-label="Selected notes">
    <strong className="selection-count">{count} selected</strong>
    <div className="selection-tools"><button type="button" onClick={onSelectAll} aria-label="Select all"><CheckCheck size={17} /><span>Select all</span></button><button type="button" onClick={() => onPin(true)} aria-label="Pin selected"><Pin size={17} /><span>Pin</span></button><button type="button" onClick={() => onPin(false)} aria-label="Unpin selected"><PinOff size={17} /><span>Unpin</span></button>
      <select value="" aria-label="Move selected to category" onChange={(event) => { if (event.target.value !== "") onMove(Number(event.target.value)); }}><option value="" disabled>Move to…</option><option value={0}>Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      <button type="button" className="batch-delete" onClick={onDelete} aria-label="Delete selected"><Trash2 size={17} /><span>Delete</span></button></div>
    <button type="button" className="selection-clear" aria-label="Clear selection" title="Clear selection" onClick={onClear}><X size={19} /></button>
  </div>;
}