"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut, Moon, Sun } from "./Icon";

export default function AccountMenu({ email, theme, onThemeToggle, onLogout }: { email: string; theme: string; onThemeToggle: () => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const name = email.split("@")[0];
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="account-menu" ref={menuRef}>
    <button ref={triggerRef} type="button" className="account-trigger" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}><span className="avatar">{name[0]?.toUpperCase()}</span><span className="account-name">{name}</span><ChevronDown size={15} className={open ? "rotated" : ""} /></button>
    <div className={"account-dropdown" + (open ? " open" : "")} id={menuId} role="menu" aria-label="Account options" aria-hidden={!open} inert={!open} onKeyDown={(event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }}><div className="account-identity"><strong>{name}</strong><span>{email}</span></div>
      <button type="button" role="menuitem" aria-label="Toggle theme" onClick={() => { onThemeToggle(); setOpen(false); triggerRef.current?.focus(); }}>{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}<span>{theme === "light" ? "Dark mode" : "Light mode"}</span></button>
      <button type="button" role="menuitem" className="account-logout" aria-label="Log out" onClick={() => { setOpen(false); onLogout(); }}><LogOut size={17} /><span>Log out</span></button>
    </div>
  </div>;
}
