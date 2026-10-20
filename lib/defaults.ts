import type { Note } from "./types";

export function createStarterNote(): Note {
  return {
    id: 1,
    title: "Get Started",
    description: "<p>Welcome to Notely! This is your space to collect ideas, plans, and everyday reminders.</p><ul><li>Choose <strong>Create note</strong> to start writing.</li><li>Create a category and pick a folder color to organize your notes.</li><li>Pin important notes or select several notes for batch actions.</li><li>Deleted notes go to <strong>Trash</strong>, where you can restore them or delete them permanently.</li></ul><p>Open this note to edit it and make it yours.</p>",
    categoryId: 0,
    background: "#FFD9B8",
    pinned: false,
    updatedAt: Date.now(),
  };
}
