"use client";

import { useEffect, useRef } from "react";
import { Trash2 } from "./Icon";
import type { Category } from "../lib/types";

export default function DeleteCategoryDialog({ category, noteCount, onClose, onDelete }: { category: Category; noteCount: number; onClose: () => void; onDelete: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; cancelRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const buttons = [...cancelRef.current?.closest("section")?.querySelectorAll<HTMLButtonElement>("button") || []];
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1]?.focus(); }
        else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0]?.focus(); }
      }
    };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", key); previous?.focus(); };
  }, [onClose]);
  return <div className="category-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="category-delete-dialog" role="dialog" aria-modal="true" aria-label="Delete category">
    <span className="category-delete-icon"><Trash2 size={21} /></span><h2>Delete “{category.name}”?</h2><p>This category will move to Trash. {noteCount ? noteCount + (noteCount === 1 ? " note will" : " notes will") + " move to Uncategorized." : "This category is empty."} You can restore the category later.</p>
    <div><button ref={cancelRef} type="button" className="category-cancel" onClick={onClose}>Cancel</button><button type="button" className="category-confirm-delete" onClick={onDelete}>Delete category</button></div>
  </section></div>;
}
