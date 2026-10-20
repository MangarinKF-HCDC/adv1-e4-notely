import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const output = path.join(process.cwd(), "artifacts", "category-trash-check");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Manila" });
const page = await context.newPage();
const errors = [];
const passed = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
const seed = {
  categories: [{ id: 10, name: "Books", color: "#B8E8E0" }, { id: 20, name: "Work", color: "#3B2A52" }, { id: 30, name: "Music", color: "#FFF0A8" }],
  notes: [
    { id: 10, title: "Read", categoryId: 10, description: "<p><strong>Keep this content</strong></p>", background: "#FFFFFF", pinned: true, updatedAt: 1000 },
    { id: 11, title: "Moved", categoryId: 10, description: "<p>Move me</p>", background: "#F7CADB", pinned: false, updatedAt: 1001 },
    { id: 20, title: "Work note", categoryId: 20, description: "<p>Work</p>", background: "#DCCFF5", pinned: false, updatedAt: 1002 },
  ],
  trash: [{ id: 30, title: "Old deleted", categoryId: 10, description: "<p>Old deleted content</p>", background: "#C5DDF8", pinned: false, updatedAt: 999, deletedAt: 1003 }],
};
await page.addInitScript((data) => {
  sessionStorage.setItem("isLoggedIn", "true");
  sessionStorage.setItem("userEmail", "review@gmail.com");
  if (sessionStorage.getItem("category-trash-seeded")) return;
  localStorage.setItem("notely-notes", JSON.stringify(data.notes));
  localStorage.setItem("notely-categories", JSON.stringify(data.categories));
  localStorage.setItem("notely-trash", JSON.stringify(data.trash));
  localStorage.setItem("notely-trash-categories", "[]");
  sessionStorage.setItem("category-trash-seeded", "true");
}, seed);
const state = () => page.evaluate(() => ({
  notes: JSON.parse(localStorage.getItem("notely-notes")),
  categories: JSON.parse(localStorage.getItem("notely-categories")),
  trash: JSON.parse(localStorage.getItem("notely-trash")),
  deletedCategories: JSON.parse(localStorage.getItem("notely-trash-categories")),
}));
const check = async (name, action) => { await action(); passed.push(name); console.log("PASS " + name); };
const openTrash = async () => {
  if (await page.getByRole("button", { name: "Open menu", exact: true }).isVisible()) await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Trash", exact: true })).toBeVisible();
};
const openAll = async () => {
  if (await page.getByRole("button", { name: "Open menu", exact: true }).isVisible()) await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.locator('.sidebar button[title="All notes"]').click();
};
const deleteCategory = async (name) => {
  await page.getByRole("button", { name: "Delete category " + name, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete category", exact: true });
  await expect(dialog).toContainText("move to Trash");
  await dialog.getByRole("button", { name: "Delete category", exact: true }).click();
};
const toolbar = () => page.getByRole("toolbar", { name: "Trash selection", exact: true });
const permanent = () => page.getByRole("button", { name: "Delete permanently", exact: true });
try {
  await page.goto("http://localhost:3000/notes");
  await expect(page.getByRole("button", { name: "Edit Read", exact: true })).toBeVisible();
  await check("category deletion persists in Trash, preserves notes, and supports search and phone layouts", async () => {
    await deleteCategory("Books");
    await page.reload();
    await expect(page.getByRole("button", { name: "Edit Read", exact: true })).toContainText("Uncategorized");
    const stored = await state();
    expect(stored.deletedCategories[0]).toMatchObject({ id: 10, name: "Books", color: "#B8E8E0" });
    expect(stored.deletedCategories[0].noteIds.sort((a, b) => a - b)).toEqual([10, 11, 30]);
    expect(stored.deletedCategories[0].deletedAt).toEqual(expect.any(Number));
    await openTrash();
    await expect(page.getByRole("button", { name: "Restore category Books", exact: true })).toBeVisible();
    const categoryCard = page.getByRole("article", { name: "Deleted category Books", exact: true });
    await expect(categoryCard.locator(".trash-note-preview")).toHaveCount(0);
    await expect(categoryCard.locator(".trash-note-meta > span")).toHaveCount(0);
    expect((await categoryCard.boundingBox()).height).toBeLessThan(160);
    await page.screenshot({ path: path.join(output, "desktop-category-trash.png"), fullPage: true });
    await page.getByRole("checkbox", { name: "Select deleted category Books", exact: true }).check();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const search = page.getByRole("textbox", { name: "Search trash", exact: true });
    await search.fill("Books");
    await expect(toolbar()).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Restore category Books", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Restore Old deleted", exact: true })).toHaveCount(0);
    await search.fill("Nothing matches");
    await expect(page.getByRole("heading", { name: "No deleted items found", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close search", exact: true }).click();
    await page.getByRole("checkbox", { name: "Select deleted category Books", exact: true }).check();
    await page.getByRole("checkbox", { name: "Select deleted Old deleted", exact: true }).check();
    await page.setViewportSize({ width: 320, height: 568 });
    for (const button of await toolbar().getByRole("button").all()) {
      const bounds = await button.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(568);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect((await categoryCard.boundingBox()).height).toBeLessThan(160);
    await page.screenshot({ path: path.join(output, "phone-category-selection.png") });
    await toolbar().getByRole("button", { name: "Clear selection", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openAll();
  });
  await check("mixed restore distinguishes note and category IDs and preserves moved notes", async () => {
    await page.getByRole("button", { name: "Edit Moved", exact: true }).click();
    await page.getByRole("dialog").getByRole("combobox", { name: "Category", exact: true }).selectOption("20");
    await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Delete Read", exact: true }).click();
    await openTrash();
    await page.getByRole("checkbox", { name: "Select deleted category Books", exact: true }).check();
    await page.getByRole("checkbox", { name: "Select deleted Read", exact: true }).check();
    await expect(toolbar()).toContainText("2 selected");
    await toolbar().getByRole("button", { name: "Restore selected", exact: true }).click();
    await page.getByRole("button", { name: "Restore Old deleted", exact: true }).click();
    await page.reload(); await openAll();
    const stored = await state();
    expect(stored.categories.find((category) => category.id === 10)).toMatchObject({ name: "Books", color: "#B8E8E0" });
    expect(stored.notes.find((note) => note.id === 10)).toEqual(seed.notes[0]);
    expect(stored.notes.find((note) => note.id === 11).categoryId).toBe(20);
    expect(stored.notes.find((note) => note.id === 30).categoryId).toBe(10);
    expect(stored.trash).toEqual([]); expect(stored.deletedCategories).toEqual([]);
  });
  await check("restoring a category with a duplicate name preserves both categories", async () => {
    await deleteCategory("Books");
    await page.getByRole("button", { name: "New category", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create category", exact: true });
    await dialog.getByRole("textbox", { name: "Category name", exact: true }).fill("Books");
    await dialog.getByRole("button", { name: "Create category", exact: true }).click();
    await expect(dialog).toBeHidden();
    await openTrash();
    await page.getByRole("button", { name: "Restore category Books", exact: true }).click();
    await page.reload();
    const stored = await state();
    expect(stored.categories.find((category) => category.id === 10)).toMatchObject({ name: "Books (restored)", color: "#B8E8E0" });
    expect(stored.categories.filter((category) => category.name === "Books")).toHaveLength(1);
    expect(stored.notes.find((note) => note.id === 10).categoryId).toBe(10);
    await openAll();
  });
  await check("bulk category restore and confirmed single/mixed permanent deletion preserve active notes", async () => {
    await deleteCategory("Music"); await deleteCategory("Work");
    await page.getByRole("button", { name: "Delete Read", exact: true }).click();
    await openTrash();
    await page.getByRole("button", { name: "Select all", exact: true }).click();
    await expect(toolbar()).toContainText("3 selected");
    await toolbar().getByRole("button", { name: "Restore selected", exact: true }).click();
    await openAll();
    expect((await state()).notes.find((note) => note.id === 11).categoryId).toBe(20);
    await deleteCategory("Music"); await deleteCategory("Work");
    await page.getByRole("button", { name: "Delete Read", exact: true }).click();
    await openTrash();
    await page.getByRole("button", { name: "Delete permanently category Music", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Permanently delete categories", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Restore category Music", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Delete permanently category Music", exact: true }).click();
    await permanent().click();
    await page.getByRole("checkbox", { name: "Select deleted category Work", exact: true }).check();
    await page.getByRole("checkbox", { name: "Select deleted Read", exact: true }).check();
    await toolbar().getByRole("button", { name: "Delete permanently selected", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Permanently delete items", exact: true })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("button", { name: "Restore category Work", exact: true })).toBeVisible();
    await toolbar().getByRole("button", { name: "Delete permanently selected", exact: true }).click();
    await permanent().click();
    await page.reload(); await openTrash();
    await expect(page.getByRole("heading", { name: "Trash is empty", exact: true })).toBeVisible();
    const stored = await state();
    expect(stored.deletedCategories).toEqual([]); expect(stored.trash).toEqual([]);
    expect(stored.categories.some((category) => [20, 30].includes(category.id))).toBe(false);
    expect(stored.notes.find((note) => note.id === 11).categoryId).toBe(0);
    expect(stored.notes.find((note) => note.id === 20).categoryId).toBe(0);
    expect(stored.notes.some((note) => note.id === 10)).toBe(false);
  });
  expect(errors).toEqual([]);
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify({ passed, browserErrors: errors }, null, 2));
  console.log("All " + passed.length + " category Trash checks passed.");
} catch (error) {
  await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify({ passed, browserErrors: errors, failure: String(error) }, null, 2));
  throw error;
} finally {
  await browser.close();
}