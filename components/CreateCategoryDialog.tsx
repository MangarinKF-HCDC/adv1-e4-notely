"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { Check, FolderPlus, X } from "./Icon";
import { getTextColor, PRESET_COLORS } from "../lib/colors";
import "../app/category-dialog.css";

type Props = {
  existingNames: string[];
  onCreate: (name: string, color: string) => void;
  onClose: () => void;
};

export default function CreateCategoryDialog({ existingNames, onCreate, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);
  const fieldId = useId();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0].hex);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    inputRef.current?.focus({ preventScroll: true });
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  function finishAfterClose(action: () => void) {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      action();
    } else {
      closeTimerRef.current = setTimeout(action, 160);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (closingRef.current) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a category name.");
      inputRef.current?.focus();
      return;
    }
    if (existingNames.some((existing) => existing.trim().toLowerCase() === trimmedName.toLowerCase())) {
      setError("A category with that name already exists.");
      inputRef.current?.focus();
      return;
    }
    finishAfterClose(() => onCreate(trimmedName, color));
  }

  return <dialog
    ref={dialogRef}
    className={"create-category-dialog" + (closing ? " is-closing" : "")}
    aria-label="Create category"
    aria-busy={closing}
    onCancel={(event) => { event.preventDefault(); finishAfterClose(onClose); }}
    onMouseDown={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) finishAfterClose(onClose);
    }}
  >
    <form className="create-category-form" onSubmit={submit} noValidate>
      <header className="create-category-header">
        <span className="create-category-icon"><FolderPlus size={23} /></span>
        <button type="button" className="create-category-close" aria-label="Close category dialog" onClick={() => finishAfterClose(onClose)}><X size={19} /></button>
      </header>
      <h2>Create category</h2>

      <div className="create-category-name-field">
        <label htmlFor={fieldId}>Category name</label>
        <input
          ref={inputRef}
          id={fieldId}
          autoFocus
          autoComplete="off"
          maxLength={80}
          placeholder="e.g. Reading list"
          value={name}
          aria-required="true"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? fieldId + "-error" : undefined}
          onChange={(event) => { setName(event.target.value); setError(""); }}
        />
        {error && <p className="create-category-error" id={fieldId + "-error"} role="alert">{error}</p>}
      </div>

      <fieldset className="create-category-colors" disabled={closing}>
        <legend className="sr-only">Folder color</legend>
        <div className="create-category-color-grid" role="radiogroup" aria-label="Folder color">
          {PRESET_COLORS.map((preset) => <label key={preset.hex} className="create-category-color-option" title={preset.name}>
            <input type="radio" name={fieldId + "-color"} aria-label={preset.name} value={preset.hex} checked={color === preset.hex} onChange={() => setColor(preset.hex)} />
            <span className="create-category-color-swatch" style={{ background: preset.hex, color: getTextColor(preset.hex) }}>
              {color === preset.hex && <Check size={18} strokeWidth={2.5} />}
            </span>
          </label>)}
        </div>
      </fieldset>

      <footer className="create-category-footer">
        <button type="button" className="create-category-cancel" onClick={() => finishAfterClose(onClose)}>Cancel</button>
        <button type="submit" className="create-category-submit" disabled={closing}><Check size={17} />Create category</button>
      </footer>
    </form>
  </dialog>;
}
