import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

(async () => {
  const output = path.join(process.cwd(), "artifacts", "notely-check");
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Manila" });
  const page = await context.newPage();
  const errors = [];
  const checks = [];
  const assetRequests = new Set();
  const externalRequests = new Set();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") externalRequests.add(request.url());
    if (/^\/(brand|icons)\/.+\.svg$/.test(url.pathname)) assetRequests.add(url.pathname);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const check = async (name, run) => { await run(); checks.push(name); console.log("PASS " + name); };
  const shot = async (name) => page.screenshot({ path: path.join(output, name + ".png"), fullPage: !/(selection|account-menu)/.test(name) && !(await page.getByRole("dialog").count()), animations: "disabled" });
  const dialog = () => page.getByRole("dialog");
  const categoryDialog = () => page.getByRole("dialog", { name: "Create category", exact: true });
  const description = () => dialog().getByRole("textbox", { name: "Description", exact: true });
  const create = async () => { await page.getByRole("button", { name: "New note", exact: true }).click(); await expect(dialog()).toBeVisible(); await dialog().evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished))); };
  const selectDescription = async () => { await description().focus(); await page.keyboard.press("Control+A"); };
  const sampleClick = (button, selector, property) => button.evaluate(async (trigger, args) => {
    const read = () => {
      const element = document.querySelector(args.selector);
      if (args.selector === ".note-modal") {
        const options = element.querySelector(".editor-options");
        if (options.scrollWidth > options.clientWidth + 1) throw new Error(`Editor controls overflow while resizing: ${options.scrollWidth}px in ${options.clientWidth}px`);
      }
      return args.property === "width" ? element.getBoundingClientRect().width : parseFloat(getComputedStyle(element)[args.property]);
    };
    const samples = [read()]; trigger.click();
    for (let frame = 0; frame < 24; frame++) { await new Promise(requestAnimationFrame); samples.push(read()); }
    return samples;
  }, { selector, property });
  const createCategory = async (name) => {
    await page.getByRole("button", { name: "New category", exact: true }).first().click();
    await expect(categoryDialog()).toBeVisible();
    await categoryDialog().getByRole("textbox", { name: "Category name", exact: true }).fill(name);
    await categoryDialog().getByRole("button", { name: "Create category", exact: true }).click();
    await expect(categoryDialog()).toBeHidden();
  };
  const openTrash = async () => {
    if (await page.getByRole("button", { name: "Open menu", exact: true }).isVisible()) await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.getByRole("button", { name: "Trash", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Trash", exact: true })).toBeVisible();
  };
  const openAllNotes = async () => {
    if (await page.getByRole("button", { name: "Open menu", exact: true }).isVisible()) await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.locator('.sidebar button[title="All notes"]').click();
  };
  const trashStored = async () => page.evaluate(() => JSON.parse(localStorage.getItem("notely-trash") || "[]"));
  try {
    await check("logged-out route protection", async () => {
      await page.goto("http://localhost:3000/notes");
      await expect(page).toHaveTitle("Notely");
      await expect(page).toHaveURL("http://localhost:3000/");
      await expect(page.locator(".login-greeting")).toContainText("It's good to see you");
    });
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".login-card").evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
    await shot("desktop-login");
    await check("login entry motion and six floating errand notes", async () => {
      await expect(page.locator(".errand-board .floating-note")).toHaveCount(6);
      await expect(page.locator(".login-card")).toHaveCSS("animation-name", "login-pane-reveal");
      await expect(page.locator(".errand-board")).toHaveCSS("animation-name", "login-art-reveal");
      for (const note of await page.locator(".errand-board .floating-note").all()) {
        await expect(note).toHaveCSS("animation-name", "login-note-bob");
      }
    });
    await check("login validation preserves card, values, and focus", async () => {
      const card = await page.locator(".login-card").elementHandle();
      const animationStart = await card.evaluate((element) => element.getAnimations()[0]?.startTime);
      await page.locator("#email").focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("#login-error")).toHaveText("Email is required.");
      await expect(page.locator(".login-fields")).toHaveClass(/shake/);
      const firstErrorCycle = await page.locator(".login-fields").getAttribute("data-error-cycle");
      await page.locator("#email").press("Enter");
      await expect(page.locator(".login-fields")).not.toHaveAttribute("data-error-cycle", firstErrorCycle);
      await expect(page.locator("#login-error span.visible")).toHaveCSS("animation-name", "login-error-reveal");
      await page.locator("#email").fill("kyle@yahoo.com");
      await page.locator("#password").fill("short");
      await page.locator("#email").press("Enter");
      await expect(page.locator("#login-error")).toHaveText("Email must end with @gmail.com.");
      await expect(page.locator("#email")).toBeFocused();
      await expect(page.locator("#password")).toHaveValue("short");
      await page.locator("#email").fill("kyle@gmail.com");
      await page.locator("#password").press("Enter");
      await expect(page.locator("#login-error")).toHaveText("Password must be more than 8 characters.");
      expect(await card.evaluate((element) => element.isConnected)).toBe(true);
      expect(await card.evaluate((element) => element.getAnimations()[0]?.startTime)).toBe(animationStart);
      await page.locator("#password").fill("password123");
      await page.locator("#password").press("Enter");
      await expect(page).toHaveURL("http://localhost:3000/notes");
    });
    await check("time greeting and removed copy", async () => {
      const hour = await page.evaluate(() => new Date().getHours());
      const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 18 ? "Good afternoon" : "Good evening";
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(greeting + ", kyle!");
      for (const text of ["A gentle reminder", "Help & feedback", "A place for every thought", "Made for the thoughts that matter.", "Keep it simple."]) await expect(page.getByText(text, { exact: true })).toHaveCount(0);
      await expect(page.getByText(/YOUR PERSONAL SPACE/i)).toHaveCount(0);
    });
    await check("first visit starts with only Get Started and no preset categories", async () => {
      await expect(page.locator(".note-card")).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Edit Get Started", exact: true })).toBeVisible();
      const stored = await page.evaluate(() => ({ notes: JSON.parse(localStorage.getItem("notely-notes")), categories: JSON.parse(localStorage.getItem("notely-categories")) }));
      expect(stored.categories).toEqual([]); expect(stored.notes).toHaveLength(1); expect(stored.notes[0].title).toBe("Get Started"); expect(stored.notes[0].categoryId).toBe(0);
      for (const name of ["Personal", "Work", "Ideas"]) await expect(page.locator('.sidebar button[title="' + name + '"]')).toHaveCount(0);
      await page.reload(); await expect(page.getByRole("button", { name: "Edit Get Started", exact: true })).toHaveCount(1);
    });
    await check("All notes and Uncategorized stay first, and Trash follows the categories", async () => {
      const chips = page.locator(".category-row .category-chip");
      await expect(chips.nth(0)).toContainText("All notes");
      await expect(chips.nth(1)).toContainText("Uncategorized");
      await expect(chips.nth(1).locator("b")).toHaveText("1");
      const sidebarAll = page.locator('.sidebar button[title="All notes"]');
      const sidebarUncategorized = page.locator('.sidebar button[title="Uncategorized"]');
      await expect(sidebarAll).toBeVisible(); await expect(sidebarUncategorized).toBeVisible();
      await expect(page.locator(".nav-group").getByRole("button", { name: /Uncategorized/ })).toHaveCount(0);
      await expect(page.locator(".category-list > :first-child")).toContainText("Uncategorized");
      const allBounds = await sidebarAll.boundingBox();
      const uncategorizedBounds = await sidebarUncategorized.boundingBox();
      expect(uncategorizedBounds.y).toBeGreaterThan(allBounds.y);
      const categoryBounds = await page.locator(".category-list").boundingBox();
      const trashBounds = await page.getByRole("button", { name: "Trash", exact: true }).boundingBox();
      expect(trashBounds.y).toBeGreaterThanOrEqual(categoryBounds.y + categoryBounds.height);
      await chips.nth(1).click();
      await expect(page.getByRole("heading", { name: "Uncategorized", exact: true })).toBeVisible();
      await chips.nth(0).click();
    });
    await check("category popup validates names, chooses colors, and persists the category", async () => {
      await page.getByRole("button", { name: "New category", exact: true }).first().click();
      const popup = categoryDialog(); await expect(popup).toBeVisible();
      await expect(popup.locator(".create-category-preview, .create-category-color-name, .create-category-intro")).toHaveCount(0);
      const name = popup.getByRole("textbox", { name: "Category name", exact: true });
      await expect(name).toBeFocused();
      await popup.getByRole("button", { name: "Create category", exact: true }).click();
      await expect(popup.getByRole("alert")).toContainText(/name/i);
      await name.fill("Uncategorized"); await popup.getByRole("button", { name: "Create category", exact: true }).click();
      await expect(popup.getByRole("alert")).toContainText(/Uncategorized|reserved|already|exists/i);
      await name.fill("Personal");
      const colors = popup.getByRole("radio"); expect(await colors.count()).toBeGreaterThanOrEqual(5);
      await colors.last().locator("..").click(); await expect(colors.last()).toBeChecked();
      await shot("desktop-category-popup");
      await popup.getByRole("button", { name: "Create category", exact: true }).click(); await expect(popup).toBeHidden();
      await expect(page.locator('.sidebar button[title="Personal"]')).toBeVisible();
      const category = await page.evaluate(() => JSON.parse(localStorage.getItem("notely-categories")).find((item) => item.name === "Personal"));
      expect(category.color).toBe("#3B2A52");
      await page.reload();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("notely-categories")).find((item) => item.name === "Personal").color)).toBe(category.color);
      const sidebarColor = await page.locator('.sidebar button[title="Personal"] .category-folder').evaluate((element) => getComputedStyle(element).fill);
      const chipColor = await page.locator(".category-chip").filter({ hasText: "Personal" }).locator(".category-folder").evaluate((element) => getComputedStyle(element).fill);
      expect(sidebarColor).toBe(chipColor);
      expect(sidebarColor).toBe(await page.evaluate((color) => { const probe = document.createElement("span"); probe.style.color = color; document.body.append(probe); const rgb = getComputedStyle(probe).color; probe.remove(); return rgb; }, category.color));
      await page.getByRole("button", { name: "New category", exact: true }).first().click();
      await popup.getByRole("textbox", { name: "Category name", exact: true }).fill(" personal ");
      await popup.getByRole("button", { name: "Create category", exact: true }).click();
      await expect(popup.getByRole("alert")).toContainText(/already|exists/i);
      await popup.getByRole("button", { name: "Cancel", exact: true }).click(); await expect(popup).toBeHidden();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("notely-categories")).length)).toBe(1);
      const starter = page.getByRole("button", { name: "Edit Get Started", exact: true });
      await starter.hover();
      const selected = starter.locator("..").getByRole("checkbox", { name: "Select Get Started", exact: true });
      await selected.check();
      const footer = page.getByRole("toolbar", { name: "Selected notes", exact: true });
      await expect(footer).toBeVisible();
      await page.getByRole("button", { name: "New category", exact: true }).first().click();
      await expect(popup).toBeVisible(); await page.keyboard.press("Escape"); await expect(popup).toBeHidden();
      await expect(footer).toBeVisible(); await expect(selected).toBeChecked();
      await footer.getByRole("button", { name: "Clear selection", exact: true }).click(); await expect(footer).toHaveCount(0);
    });
    await check("category popup fits a small phone and cancel preserves data", async () => {
      const before = await page.evaluate(() => localStorage.getItem("notely-categories"));
      await page.setViewportSize({ width: 320, height: 568 });
      await page.getByRole("button", { name: "New category", exact: true }).first().click();
      const popup = categoryDialog(); await expect(popup).toBeVisible();
      await popup.getByRole("textbox", { name: "Category name", exact: true }).fill("Cancelled category");
      const bounds = await popup.boundingBox(); expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(320); expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(568);
      for (const control of await popup.locator("button,input").all()) { const box = await control.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(320); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      await shot("small-phone-category-popup");
      await popup.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(popup).toBeHidden(); expect(await page.evaluate(() => localStorage.getItem("notely-categories"))).toBe(before);
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await check("sidebar has no duplicate branding and toggle aligns with Create note", async () => {
      await expect(page.locator(".sidebar .brand")).toHaveCount(0);
      const createButton = await page.getByRole("button", { name: "Create note", exact: true }).boundingBox();
      const expanded = await page.getByRole("button", { name: "Collapse sidebar" }).boundingBox();
      expect(Math.abs(createButton.y + createButton.height / 2 - expanded.y - expanded.height / 2)).toBeLessThan(2);
      expect(expanded.x).toBeGreaterThan(createButton.x + createButton.width);
      const widths = await sampleClick(page.getByRole("button", { name: "Collapse sidebar" }), ".sidebar", "width");
      expect(widths.some((width) => width > 65 && width < widths[0] - 1)).toBe(true);
      await expect.poll(() => page.locator(".sidebar").evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(64);
      const rail = await page.locator(".sidebar").boundingBox();
      const toggle = await page.getByRole("button", { name: "Expand sidebar" }).boundingBox();
      const compactCreate = await page.getByRole("button", { name: "Create note", exact: true }).boundingBox();
      expect(Math.abs(toggle.x + toggle.width / 2 - rail.x - rail.width / 2)).toBeLessThan(2);
      expect(toggle.y).toBeGreaterThan(compactCreate.y + compactCreate.height);
      await page.getByRole("button", { name: "Create note", exact: true }).click();
      await expect(dialog()).toBeVisible(); await dialog().getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("button", { name: "Expand sidebar" }).click();
    });
    await check("new notes use the current category color and saved notes keep their own color", async () => {
      await create();
      await expect(dialog()).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await expect(dialog().getByRole("textbox", { name: "Custom hex", exact: true })).toHaveValue("#FFFFFF");
      await dialog().getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: "Personal" });
      await expect(dialog()).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await dialog().getByRole("button", { name: "Cancel", exact: true }).click();
      await page.locator(".category-chip").filter({ hasText: "Personal" }).click();
      await create();
      await expect(dialog()).toHaveCSS("background-color", "rgb(59, 42, 82)");
      await expect(dialog().getByRole("textbox", { name: "Custom hex", exact: true })).toHaveValue("#3B2A52");
      await dialog().getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: "Uncategorized" });
      await expect(dialog()).toHaveCSS("background-color", "rgb(59, 42, 82)");
      await dialog().getByRole("button", { name: "Cancel", exact: true }).click();
      await page.locator(".category-chip").filter({ hasText: "Uncategorized" }).click();
      await create();
      await expect(dialog()).toHaveCSS("background-color", "rgb(213, 217, 228)");
      await expect(dialog().getByRole("textbox", { name: "Custom hex", exact: true })).toHaveValue("#D5D9E4");
      await dialog().getByRole("button", { name: "Cancel", exact: true }).click();
      await page.locator(".category-chip").filter({ hasText: "All notes" }).click();
      await page.getByRole("button", { name: "Edit Get Started", exact: true }).click();
      await expect(dialog()).toHaveCSS("background-color", "rgb(255, 217, 184)");
      await expect(dialog().getByRole("textbox", { name: "Custom hex", exact: true })).toHaveValue("#FFD9B8");
      await dialog().getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: "Personal" });
      await expect(dialog()).toHaveCSS("background-color", "rgb(255, 217, 184)");
      await dialog().getByRole("button", { name: "Cancel", exact: true }).click();
    });
    await create();
    await expect(dialog()).toBeVisible();
    await check("centered modal, widened view, one-line controls, and empty title validation", async () => {
      await expect.poll(async () => Math.round((await dialog().boundingBox()).width)).toBe(640);
      const box = await dialog().boundingBox();
      expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThan(1);
      const buttons = await Promise.all(["Pin note", "Full screen", "Close note"].map((name) => dialog().getByRole("button", { name, exact: true }).boundingBox()));
      expect(buttons[0].x).toBeLessThan(buttons[1].x); expect(buttons[1].x).toBeLessThan(buttons[2].x);
      await dialog().getByRole("button", { name: "Save", exact: true }).click();
      await expect(dialog().getByRole("alert").first()).toHaveText("Title is required.");
      const widths = await sampleClick(dialog().getByRole("button", { name: "Full screen", exact: true }), ".note-modal", "width");
      expect(widths.some((width) => width > 641 && width < 1159)).toBe(true);
      await expect.poll(async () => Math.round((await dialog().boundingBox()).width)).toBe(1160);
      const full = await dialog().boundingBox();
      expect(full.x).toBeGreaterThan(0); expect(full.y).toBeGreaterThan(0); expect(full.height).toBeLessThan(1000);
      expect(Math.abs(full.x + full.width / 2 - 720)).toBeLessThan(1);
      const toolbar = await dialog().locator(".rich-toolbar").boundingBox();
      const colors = await dialog().locator(".modal-color-panel").boundingBox();
      expect(colors.x).toBeGreaterThanOrEqual(toolbar.x + toolbar.width - 1);
      expect(Math.abs(toolbar.y + toolbar.height / 2 - colors.y - colors.height / 2)).toBeLessThan(3);
      const tools = await dialog().locator(".rich-toolbar .tool-button").all();
      const toolBounds = await Promise.all(tools.map((tool) => tool.boundingBox()));
      expect(Math.max(...toolBounds.map((bounds) => bounds.y)) - Math.min(...toolBounds.map((bounds) => bounds.y))).toBeLessThan(3);
      await shot("desktop-modal-wide");
      await dialog().getByRole("button", { name: "Exit full screen" }).click();
    });
    await check("custom hex typing, blur validation, swatches, and color wheel", async () => {
      const hex = dialog().getByRole("textbox", { name: "Custom hex" });
      await hex.fill("#"); await hex.pressSequentially("FF9F68");
      await expect(hex).toHaveValue("#FF9F68");
      await expect(dialog()).toHaveCSS("background-color", "rgb(255, 159, 104)");
      await expect(dialog().locator(".hex-error")).toHaveText("");
      await hex.fill("#FFF"); await hex.press("Tab");
      await expect(hex).toHaveValue("#FFFFFF");
      await hex.fill("#ZZZ");
      await expect(dialog().locator(".hex-error")).toHaveText("");
      await hex.press("Tab");
      await expect(dialog().locator(".hex-error")).toHaveText("Enter a valid hex, such as #FFD9B8.");
      await expect(dialog()).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await dialog().getByRole("button", { name: "Sea Glass", exact: true }).click();
      await expect(hex).toHaveValue("#B8E8E0"); await expect(dialog().locator(".hex-error")).toHaveText("");
      await dialog().getByLabel("Color wheel", { exact: true }).evaluate((input) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "#3b2a52"); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); });
      await expect(hex).toHaveValue("#3B2A52"); await expect(dialog()).toHaveCSS("color", "rgb(255, 255, 255)");
      await dialog().getByRole("button", { name: "Sea Glass", exact: true }).click();
    });
    await dialog().getByRole("textbox", { name: "Title", exact: true }).fill("Formatted thoughts");
    await description().fill("Hello formatted world");
    await check("rich text styles, font sizes, alignment, and popover Escape", async () => {
      await selectDescription();
      for (const name of ["Bold", "Italic", "Underline", "Strikethrough"]) await dialog().getByRole("button", { name, exact: true }).click();
      await expect(description().locator("strong em u s, s u em strong, strong")).not.toHaveCount(0);
      await dialog().getByRole("button", { name: "Font size", exact: true }).click();
      await dialog().getByRole("menuitem", { name: "20", exact: true }).click();
      await expect(description().locator('span[style*="font-size: 20px"]')).toHaveCount(1);
      for (const [name, align] of [["Align center", "center"], ["Align right", "right"], ["Justify", "justify"], ["Align left", "left"]]) {
        await dialog().getByRole("button", { name, exact: true }).click();
        await expect(description().locator("p").first()).toHaveCSS("text-align", align);
      }
      await dialog().getByRole("button", { name: "Font size", exact: true }).click(); await page.keyboard.press("Escape");
      await expect(dialog().getByRole("menu")).toHaveCount(0); await expect(dialog()).toBeVisible();
      await dialog().getByRole("button", { name: "Font size", exact: true }).click();
      await dialog().getByRole("textbox", { name: "Title", exact: true }).click();
      await expect(dialog().getByRole("menu")).toHaveCount(0);
      await shot("desktop-modal");
    });
    await dialog().getByRole("button", { name: "Save", exact: true }).click();
    await check("formatted HTML persists and search uses visible text", async () => {
      await expect(page.getByRole("button", { name: "Edit Formatted thoughts", exact: true })).toBeVisible();
      await page.reload();
      const html = await page.evaluate(() => JSON.parse(localStorage.getItem("notely-notes"))[0].description);
      for (const tag of ["<strong>", "<em>", "<u>", "<s>"]) expect(html).toContain(tag);
      expect(html).toContain("font-size: 20px");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.getByRole("textbox", { name: "Search notes" }).fill("formatted world");
      await expect(page.locator(".note-card")).toHaveCount(1);
      await page.getByRole("button", { name: "Close search" }).click();
    });
    await check("Description placeholder hides for empty list formats and returns for an empty paragraph", async () => {
      for (const name of ["Bullets", "Numbers", "Letters", "Checklist"]) {
        await create();
        const placeholder = dialog().locator(".editor-placeholder");
        const button = dialog().getByRole("button", { name, exact: true });
        await expect(placeholder).toBeVisible();
        await button.click();
        await expect(description().locator("li")).toHaveCount(1);
        await expect(placeholder).toHaveCount(0);
        await button.click();
        await expect(placeholder).toBeVisible();
        await button.click();
        await description().pressSequentially("List item");
        await expect(placeholder).toHaveCount(0);
        await description().press("Control+A");
        await description().press("Backspace");
        if (await button.getAttribute("aria-pressed") === "true") await button.click();
        await expect(placeholder).toBeVisible();
        await dialog().getByRole("button", { name: "Cancel", exact: true }).click();
      }
    });
    await create(); await dialog().getByRole("textbox", { name: "Title", exact: true }).fill("Lists");
    await description().fill("First item"); await description().press("Enter"); await description().pressSequentially("Second item"); await selectDescription();
    await check("bullets, numbers, and letters", async () => {
      await dialog().getByRole("button", { name: "Bullets", exact: true }).click(); await expect(description().locator("ul")).toHaveCount(1);
      await dialog().getByRole("button", { name: "Numbers", exact: true }).click(); await expect(description().locator("ol")).toHaveCount(1);
      await dialog().getByRole("button", { name: "Letters", exact: true }).click(); await expect(description().locator('ol[type="a"]')).toHaveCount(1); await expect(description().locator("li")).toHaveCount(2);
    });
    await dialog().getByRole("button", { name: "Save", exact: true }).click();
    await check("checklist creates interactive tasks and preserves completion", async () => {
      await create(); await dialog().getByRole("textbox", { name: "Title", exact: true }).fill("Checklist");
      await description().fill("Pick up groceries");
      await dialog().getByRole("button", { name: "Checklist", exact: true }).click();
      const task = description().locator('ul[data-type="taskList"] li[data-type="taskItem"]');
      await expect(task).toHaveCount(1);
      await task.locator('input[type="checkbox"]').check();
      await expect(task).toHaveAttribute("data-checked", "true");
      await dialog().getByRole("button", { name: "Save", exact: true }).click();
      await page.reload();
      await page.getByRole("button", { name: "Edit Checklist", exact: true }).click();
      await expect(description().locator('li[data-type="taskItem"]')).toHaveAttribute("data-checked", "true");
      await expect(description().locator('input[type="checkbox"]')).toBeChecked();
      await dialog().getByRole("button", { name: "Delete", exact: true }).click();
    });
    await create(); await dialog().getByRole("textbox", { name: "Title", exact: true }).fill("Short note"); await dialog().getByRole("button", { name: "Save", exact: true }).click();
    await create(); await dialog().getByRole("textbox", { name: "Title", exact: true }).fill("Long note"); await description().fill("A longer thought to check the square size limit. ".repeat(100));
    await dialog().getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: "Personal" });
    await dialog().getByRole("button", { name: "Pin note", exact: true }).click(); await dialog().getByRole("button", { name: "Save", exact: true }).click();
    await check("short tiles shrink, long tiles stop at square, and pinned category notes remain visible", async () => {
      const short = await page.getByRole("button", { name: "Edit Short note", exact: true }).boundingBox();
      const long = await page.getByRole("button", { name: "Edit Long note", exact: true }).boundingBox();
      expect(short.height).toBeLessThan(short.width - 10); expect(long.height).toBeLessThanOrEqual(long.width + 1); expect(long.height).toBeGreaterThan(short.height + 10);
      await page.locator(".category-chip").filter({ hasText: "Personal" }).click();
      await expect(page.getByRole("button", { name: "Edit Long note", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Edit Long note", exact: true }).locator(".category-folder")).toHaveCSS("fill", "rgb(59, 42, 82)");
      await page.locator(".category-chip").filter({ hasText: "All notes" }).click();
      expect(await page.locator(".note-grid").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(4);
      await shot("desktop-notes");
    });
    await check("note titles align with persistent pin and delete controls", async () => {
      await page.getByRole("heading", { level: 1 }).hover();
      const card = page.getByRole("button", { name: "Edit Short note", exact: true });
      const title = await card.getByRole("heading", { name: "Short note", exact: true }).boundingBox();
      const pin = card.getByRole("button", { name: "Pin Short note", exact: true });
      const remove = card.getByRole("button", { name: "Delete Short note", exact: true });
      for (const control of [pin, remove]) {
        await expect(control).toBeVisible(); await expect(control).toHaveCSS("opacity", "1");
        const bounds = await control.boundingBox();
        expect(Math.abs(title.y + title.height / 2 - bounds.y - bounds.height / 2)).toBeLessThan(3);
      }
    });
    await check("selection footer supports select all, pinning, moving, and clearing", async () => {
      await createCategory("Temporary");
      for (const title of ["Batch one", "Batch two"]) {
        await create(); await dialog().getByRole("textbox", { name: "Title", exact: true }).fill(title);
        await dialog().getByRole("button", { name: "Save", exact: true }).click();
      }
      const first = page.getByRole("button", { name: "Edit Batch one", exact: true });
      await first.hover(); await first.locator("..").getByRole("checkbox", { name: "Select Batch one", exact: true }).check();
      await page.getByRole("checkbox", { name: "Select Batch two", exact: true }).check();
      const footer = page.getByRole("toolbar", { name: "Selected notes", exact: true });
      await expect(footer).toBeVisible(); await expect(footer).toHaveCSS("position", "fixed");
      const bounds = await footer.boundingBox(); expect(bounds.y + bounds.height).toBeLessThanOrEqual(1000);
      await footer.getByRole("button", { name: "Pin selected", exact: true }).click();
      for (const title of ["Batch one", "Batch two"]) await expect(page.getByRole("button", { name: "Unpin " + title, exact: true })).toBeVisible();
      await footer.getByRole("button", { name: "Unpin selected", exact: true }).click();
      await footer.getByRole("combobox", { name: "Move selected to category", exact: true }).selectOption({ label: "Temporary" });
      expect(await page.evaluate(() => {
        const category = JSON.parse(localStorage.getItem("notely-categories")).find((item) => item.name === "Temporary");
        return JSON.parse(localStorage.getItem("notely-notes")).filter((note) => note.title.startsWith("Batch ")).every((note) => note.categoryId === category.id && !note.pinned);
      })).toBe(true);
      await footer.getByRole("button", { name: "Select all", exact: true }).click();
      expect(await page.getByRole("checkbox", { checked: true }).count()).toBe(await page.locator(".note-card").count());
      await shot("desktop-selection");
      await footer.getByRole("button", { name: "Clear selection", exact: true }).click(); await expect(footer).toHaveCount(0);
    });
    await check("note tiles fill each row left to right and wrap on desktop, tablet, and phones", async () => {
      for (const [width, height, columns, screenshot] of [
        [1440, 1000, 4, "desktop-note-rows"],
        [900, 900, 3, "tablet-note-rows"],
        [390, 844, 2, "phone-note-rows"],
        [320, 568, 2, "small-phone-note-rows"],
      ]) {
        await page.setViewportSize({ width, height });
        for (const grid of await page.locator(".note-grid").all()) {
          await expect(grid).toHaveCSS("display", "grid");
          const layout = await grid.evaluate((element) => ({
            columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
            gap: parseFloat(getComputedStyle(element).rowGap),
            boxes: [...element.children].map((tile) => {
              const box = tile.getBoundingClientRect();
              return { x: box.x, y: box.y, width: box.width, height: box.height };
            }),
          }));
          expect(layout.columns).toBe(columns);
          for (let index = 0; index < layout.boxes.length; index += 1) {
            const box = layout.boxes[index];
            const rowStart = Math.floor(index / columns) * columns;
            expect(Math.abs(box.y - layout.boxes[rowStart].y)).toBeLessThan(1);
            if (index % columns > 0) expect(box.x).toBeGreaterThan(layout.boxes[index - 1].x + layout.boxes[index - 1].width);
            if (index >= columns && index % columns === 0) {
              const previousRow = layout.boxes.slice(index - columns, index);
              expect(box.y).toBeGreaterThanOrEqual(Math.max(...previousRow.map((previous) => previous.y + previous.height)) + layout.gap - 1);
              expect(Math.abs(box.x - layout.boxes[0].x)).toBeLessThan(1);
            }
          }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await shot(screenshot);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await check("deleting a category preserves notes and batch delete moves selected notes to Trash", async () => {
      await page.getByRole("button", { name: "Delete category Temporary", exact: true }).click();
      const confirmation = page.getByRole("dialog", { name: "Delete category", exact: true });
      await expect(confirmation).toBeVisible();
      await confirmation.getByRole("button", { name: "Delete category", exact: true }).click();
      await expect(page.locator(".category-chip").filter({ hasText: "Temporary" })).toHaveCount(0);
      await openTrash();
      await expect(page.getByRole("button", { name: "Restore category Temporary", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Delete permanently category Temporary", exact: true }).click();
      await page.getByRole("dialog", { name: "Permanently delete categories", exact: true }).getByRole("button", { name: "Delete permanently", exact: true }).click();
      await openAllNotes();
      await page.reload();
      for (const title of ["Batch one", "Batch two"]) {
        const card = page.getByRole("button", { name: "Edit " + title, exact: true });
        await expect(card).toBeVisible(); await expect(card).toContainText("Uncategorized");
        await card.hover(); await card.locator("..").getByRole("checkbox", { name: "Select " + title, exact: true }).check();
      }
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("notely-notes")).filter((note) => note.title.startsWith("Batch ")).every((note) => note.categoryId === 0))).toBe(true);
      await page.getByRole("toolbar", { name: "Selected notes", exact: true }).getByRole("button", { name: "Delete selected", exact: true }).click();
      for (const title of ["Batch one", "Batch two"]) await expect(page.getByRole("button", { name: "Edit " + title, exact: true })).toHaveCount(0);
      await expect.poll(async () => (await trashStored()).filter((note) => note.title.startsWith("Batch ")).length).toBe(2);
      for (const title of ["Batch one", "Batch two"]) expect((await trashStored()).find((note) => note.title === title).deletedAt).toEqual(expect.any(Number));
      await page.reload();
      for (const title of ["Batch one", "Batch two"]) await expect(page.getByRole("button", { name: "Edit " + title, exact: true })).toHaveCount(0);
    });
    await check("Trash restores one or multiple notes with their original content", async () => {
      await openTrash();
      for (const title of ["Batch one", "Batch two", "Checklist"]) await expect(page.getByRole("button", { name: "Restore " + title, exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Restore Batch one", exact: true }).click();
      await expect(page.getByRole("button", { name: "Restore Batch one", exact: true })).toHaveCount(0);
      for (const title of ["Batch two", "Checklist"]) await page.getByRole("checkbox", { name: "Select deleted " + title, exact: true }).check();
      const selection = page.getByRole("toolbar", { name: "Trash selection", exact: true });
      await expect(selection).toBeVisible();
      await selection.getByRole("button", { name: "Restore selected", exact: true }).click();
      await expect(selection).toHaveCount(0);
      await expect.poll(async () => (await trashStored()).length).toBe(0);
      await openAllNotes(); await page.reload();
      for (const title of ["Batch one", "Batch two", "Checklist"]) await expect(page.getByRole("button", { name: "Edit " + title, exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Edit Checklist", exact: true }).click();
      await expect(description().locator('li[data-type="taskItem"]')).toHaveAttribute("data-checked", "true");
      await dialog().getByRole("button", { name: "Close note", exact: true }).click();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("notely-notes")).filter((note) => note.title.startsWith("Batch ")).every((note) => note.categoryId === 0 && !("deletedAt" in note)))).toBe(true);
    });
    await check("card deletion persists in Trash", async () => {
      for (const title of ["Discard one", "Discard two", "Discard three"]) {
        await create(); await dialog().getByRole("textbox", { name: "Title", exact: true }).fill(title);
        await dialog().getByRole("button", { name: "Save", exact: true }).click();
        await page.getByRole("button", { name: "Delete " + title, exact: true }).click();
        await expect(page.getByRole("button", { name: "Edit " + title, exact: true })).toHaveCount(0);
      }
      await page.reload(); await openTrash(); await shot("desktop-trash");
      for (const title of ["Discard one", "Discard two", "Discard three"]) await expect(page.getByRole("button", { name: "Restore " + title, exact: true })).toBeVisible();
    });
    await check("Trash search clears selection and shows an accurate empty result", async () => {
      const storedBeforeSearch = await trashStored();
      await page.getByRole("checkbox", { name: "Select deleted Discard three", exact: true }).check();
      await expect(page.getByRole("toolbar", { name: "Trash selection", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page.getByRole("textbox", { name: "Search trash", exact: true }).fill("Discard two");
      await expect(page.getByRole("toolbar", { name: "Trash selection", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Restore Discard two", exact: true })).toBeVisible();
      for (const title of ["Discard one", "Discard three"]) await expect(page.getByRole("button", { name: "Restore " + title, exact: true })).toHaveCount(0);
      await page.getByRole("textbox", { name: "Search trash", exact: true }).fill("No matching deleted note");
      await expect(page.getByRole("heading", { name: "No deleted items found", exact: true })).toBeVisible();
      expect(await trashStored()).toEqual(storedBeforeSearch);
      await page.getByRole("button", { name: "Close search", exact: true }).click();
      for (const title of ["Discard one", "Discard two", "Discard three"]) await expect(page.getByRole("button", { name: "Restore " + title, exact: true })).toBeVisible();
      await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
    });
    await check("permanent deletion requires confirmation and stays deleted after reload", async () => {
      await page.getByRole("button", { name: "Delete permanently Discard one", exact: true }).click();
      const confirmation = page.getByRole("dialog", { name: "Permanently delete notes", exact: true });
      await expect(confirmation).toBeVisible();
      await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByRole("button", { name: "Restore Discard one", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Delete permanently Discard one", exact: true }).click();
      await confirmation.getByRole("button", { name: "Delete permanently", exact: true }).click();
      await expect(page.getByRole("button", { name: "Restore Discard one", exact: true })).toHaveCount(0);
      await page.reload(); await openTrash();
      expect((await trashStored()).some((note) => note.title === "Discard one")).toBe(false);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("notely-notes")).some((note) => note.title === "Discard one"))).toBe(false);
    });
    await check("Trash batch actions fit desktop and phones, and permanently delete multiple notes", async () => {
      await page.getByRole("checkbox", { name: "Select deleted Discard two", exact: true }).check();
      const selection = page.getByRole("toolbar", { name: "Trash selection", exact: true });
      await selection.getByRole("button", { name: "Select all", exact: true }).click();
      await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(2);
      await selection.getByRole("button", { name: "Clear selection", exact: true }).click();
      await expect(selection).toHaveCount(0);
      for (const title of ["Discard two", "Discard three"]) await page.getByRole("checkbox", { name: "Select deleted " + title, exact: true }).check();
      for (const [width, height, screenshot] of [[1440, 1000, "desktop-trash-selection"], [390, 844, "phone-trash-selection"], [320, 568, "small-phone-trash-selection"]]) {
        await page.setViewportSize({ width, height });
        await expect(selection).toBeVisible(); await expect(selection).toHaveCSS("position", "fixed");
        const bounds = await selection.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width); expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        for (const control of await selection.getByRole("button").all()) {
          await expect(control).toBeVisible(); const controlBounds = await control.boundingBox();
          expect(controlBounds.x).toBeGreaterThanOrEqual(0); expect(controlBounds.x + controlBounds.width).toBeLessThanOrEqual(width);
          expect(controlBounds.y).toBeGreaterThanOrEqual(0); expect(controlBounds.y + controlBounds.height).toBeLessThanOrEqual(height);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await shot(screenshot);
      }
      await selection.getByRole("button", { name: "Delete permanently selected", exact: true }).click();
      const confirmation = page.getByRole("dialog", { name: "Permanently delete notes", exact: true });
      await expect(confirmation).toBeVisible();
      const bounds = await confirmation.boundingBox(); expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
      await confirmation.getByRole("button", { name: "Delete permanently", exact: true }).click();
      await expect(selection).toHaveCount(0); await expect.poll(async () => (await trashStored()).length).toBe(0);
      await page.setViewportSize({ width: 1440, height: 1000 }); await page.reload(); await openTrash();
      for (const title of ["Discard two", "Discard three"]) await expect(page.getByRole("button", { name: "Restore " + title, exact: true })).toHaveCount(0);
      await shot("desktop-trash-empty"); await openAllNotes();
    });
    await check("account menu opens and closes with smooth motion", async () => {
      const account = page.getByRole("button", { name: "Account menu", exact: true });
      const opening = await sampleClick(account, ".account-dropdown", "opacity");
      expect(opening.some((opacity) => opacity > 0 && opacity < 1)).toBe(true);
      await expect(page.getByRole("menu", { name: "Account options", exact: true })).toBeVisible();
      const closing = await sampleClick(account, ".account-dropdown", "opacity");
      expect(closing.some((opacity) => opacity > 0 && opacity < 1)).toBe(true);
      await expect(page.getByRole("menu", { name: "Account options", exact: true })).toHaveCount(0);
    });
    await check("reduced motion disables sidebar, note, and account transitions", async () => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const assertStill = async (element) => {
        const duration = await element.evaluate((node) => {
          const style = getComputedStyle(node);
          return Math.max(...(style.transitionDuration + "," + style.animationDuration).split(",").map((value) => parseFloat(value) * (value.trim().endsWith("ms") ? 0.001 : 1)));
        });
        expect(duration).toBeLessThanOrEqual(0.01);
      };
      await assertStill(page.locator(".sidebar"));
      await assertStill(page.locator(".sidebar-overlay"));
      await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
      await expect.poll(() => page.locator(".sidebar").evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(64);
      await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
      await create(); await assertStill(dialog());
      await dialog().getByRole("button", { name: "Full screen", exact: true }).click();
      await expect.poll(async () => Math.round((await dialog().boundingBox()).width)).toBe(1160);
      await dialog().getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("button", { name: "Account menu", exact: true }).click();
      await expect(page.getByRole("menu")).toBeVisible(); await assertStill(page.locator(".account-dropdown"));
      await page.keyboard.press("Escape"); await expect(page.getByRole("menu")).toHaveCount(0);
      await page.emulateMedia({ reducedMotion: "no-preference" });
    });
    await check("account dropdown contains theme and logout, and theme persists", async () => {
      await expect(page.getByRole("button", { name: "Toggle theme", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Log out", exact: true })).toHaveCount(0);
      const account = page.getByRole("button", { name: "Account menu", exact: true });
      await expect(account).toContainText("kyle"); await account.click();
      const menu = page.getByRole("menu"); await expect(menu).toBeVisible();
      await expect(menu.getByText("Log out", { exact: true })).toBeVisible();
      await shot("desktop-account-menu");
      await menu.locator('[aria-label="Toggle theme"]').click(); await page.reload();
      await expect(page.locator("html")).toHaveClass(/dark/); await shot("desktop-dark");
      await account.click(); await page.getByRole("menu").locator('[aria-label="Toggle theme"]').click();
      if (await page.getByRole("menu").count()) await page.keyboard.press("Escape");
    });
    await check("tablet and phone layouts have no overflow or misplaced controls", async () => {
      await page.setViewportSize({ width: 900, height: 900 });
      expect(await page.locator(".note-grid").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(3); await shot("tablet-notes");
      await page.setViewportSize({ width: 390, height: 844 });
      await expect.poll(() => page.locator(".sidebar").evaluate((element) => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      expect(await page.locator(".note-grid").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(2); await shot("phone-notes");
      const opening = await sampleClick(page.getByRole("button", { name: "Open menu" }), ".sidebar-overlay", "opacity");
      expect(opening.some((opacity) => opacity > 0 && opacity < 1)).toBe(true); await expect(page.locator(".sidebar")).toHaveClass(/mobile-open/);
      const closing = await sampleClick(page.getByRole("button", { name: "Close menu" }), ".sidebar-overlay", "opacity");
      expect(closing.some((opacity) => opacity > 0 && opacity < 1)).toBe(true);
      await createCategory("Errands");
      await expect(page.locator(".category-chip").filter({ hasText: "Errands" })).toBeVisible();
      await create(); await dialog().getByRole("textbox", { name: "Title", exact: true }).fill("Phone note");
      const box = await dialog().boundingBox(); expect(box.x).toBeGreaterThanOrEqual(12); expect(box.y).toBeGreaterThanOrEqual(12); expect(box.width).toBeLessThanOrEqual(366); expect(box.height).toBeLessThanOrEqual(820);
      for (const button of await dialog().locator(".tool-button").all()) { const bounds = await button.boundingBox(); expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390); }
      await shot("phone-modal"); await dialog().getByRole("button", { name: "Cancel", exact: true }).click();
    });
    await check("phone selection footer and every batch control fit the viewport", async () => {
      for (const [width, height, screenshot] of [[390, 844, "phone-selection"], [320, 568, "small-phone-selection"]]) {
        await page.setViewportSize({ width, height });
        const card = page.getByRole("button", { name: "Edit Short note", exact: true });
        await card.hover();
        await card.locator("..").getByRole("checkbox", { name: "Select Short note", exact: true }).check();
        const footer = page.getByRole("toolbar", { name: "Selected notes", exact: true });
        await expect(footer).toBeVisible(); await expect(footer).toHaveCSS("position", "fixed");
        const bounds = await footer.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width); expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        for (const control of await footer.locator("button,select").all()) {
          await expect(control).toBeVisible();
          const controlBounds = await control.boundingBox();
          expect(controlBounds.x).toBeGreaterThanOrEqual(0); expect(controlBounds.x + controlBounds.width).toBeLessThanOrEqual(width);
          expect(controlBounds.y).toBeGreaterThanOrEqual(0); expect(controlBounds.y + controlBounds.height).toBeLessThanOrEqual(height);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await shot(screenshot);
        await footer.getByRole("button", { name: "Clear selection", exact: true }).click();
        await expect(footer).toHaveCount(0);
      }
      await page.setViewportSize({ width: 390, height: 844 });
    });
    await check("small phone controls fit and letter formatting survives reload", async () => {
      await page.setViewportSize({ width: 320, height: 568 });
      await create();
      expect(await dialog().evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(320);
      const footer = await dialog().locator(".modal-footer").boundingBox();
      expect(footer.y + footer.height).toBeLessThanOrEqual(568);
      for (const button of await dialog().locator(".tool-button,.modal-footer button").all()) {
        const bounds = await button.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
      }
      await shot("small-phone-modal");
      await page.keyboard.press("Escape"); await expect(dialog()).toHaveCount(0);
      await page.setViewportSize({ width: 390, height: 844 }); await page.reload();
      await page.getByRole("button", { name: "Edit Lists", exact: true }).click();
      await expect(description().locator('ol[type="a"]')).toHaveCount(1);
      await expect(description().locator("li")).toHaveCount(2);
      await dialog().getByRole("button", { name: "Close note", exact: true }).click();
    });
    await check("stored HTML is sanitized before card rendering", async () => {
      await page.evaluate(() => {
        const notes = JSON.parse(localStorage.getItem("notely-notes"));
        notes.push({ id: 99, title: "Sanitization check", description: '<p onclick="window.notelyUnsafe=true">Safe text</p><img src=x onerror="window.notelyUnsafe=true"><script>window.notelyUnsafe=true</script>', categoryId: 1, background: "#FFD9B8", pinned: false, updatedAt: Date.now() });
        localStorage.setItem("notely-notes", JSON.stringify(notes));
      });
      await page.reload();
      const card = page.getByRole("button", { name: "Edit Sanitization check", exact: true });
      await expect(card).toBeVisible(); await expect(card.locator("script,img,[onclick]")).toHaveCount(0);
      expect(await page.evaluate(() => window.notelyUnsafe)).toBeUndefined();
      await card.click(); await dialog().getByRole("button", { name: "Delete", exact: true }).click();
    });
    await check("deleting the last category persists and uncategorized notes remain editable", async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      const categories = await page.evaluate(() => JSON.parse(localStorage.getItem("notely-categories")));
      for (const category of categories) {
        await page.getByRole("button", { name: "Delete category " + category.name, exact: true }).click();
        await page.getByRole("dialog", { name: "Delete category", exact: true }).getByRole("button", { name: "Delete category", exact: true }).click();
      }
      await page.reload();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("notely-categories")))).toEqual([]);
      await expect(page.getByRole("button", { name: /^Delete category / })).toHaveCount(0);
      await create(); await dialog().getByRole("textbox", { name: "Title", exact: true }).fill("Without category");
      await expect(dialog().getByRole("combobox", { name: "Category", exact: true })).toHaveValue("0");
      await dialog().getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("button", { name: "Edit Without category", exact: true }).click();
      await dialog().getByRole("button", { name: "Delete", exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
    });
    await check("saved empty workspaces and existing notes are preserved", async () => {
      const savedContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const savedPage = await savedContext.newPage();
      savedPage.on("pageerror", (error) => errors.push(error.message));
      try {
        await savedPage.goto("http://localhost:3000/");
        await savedPage.evaluate(() => {
          sessionStorage.setItem("isLoggedIn", "true"); sessionStorage.setItem("userEmail", "existing@gmail.com");
          for (const key of ["notely-notes", "notely-categories", "notely-trash"]) localStorage.setItem(key, "[]");
        });
        await savedPage.goto("http://localhost:3000/notes");
        await expect(savedPage.getByRole("heading", { name: "No notes yet", exact: true })).toBeVisible();
        await expect(savedPage.locator(".note-card")).toHaveCount(0); await savedPage.reload();
        await expect(savedPage.getByRole("heading", { name: "No notes yet", exact: true })).toBeVisible();
        await expect(savedPage.locator(".note-card")).toHaveCount(0);
        const data = {
          notes: [{ id: 17, title: "Existing note", description: "<p><strong>Keep my content</strong></p>", categoryId: 42, background: "#B8E8E0", pinned: true, updatedAt: 1740000000000 }],
          categories: [{ id: 42, name: "Existing category", color: "#F7CADB" }],
          trash: [{ id: 18, title: "Existing deleted note", description: "<p>Keep my deleted content</p>", categoryId: 42, background: "#FFD9B8", pinned: false, updatedAt: 1740000000000, deletedAt: 1741000000000 }],
        };
        await savedPage.addInitScript((stored) => { localStorage.setItem("notely-notes", JSON.stringify(stored.notes)); localStorage.setItem("notely-categories", JSON.stringify(stored.categories)); localStorage.setItem("notely-trash", JSON.stringify(stored.trash)); }, data);
        await savedPage.reload(); await expect(savedPage.getByRole("button", { name: "Edit Existing note", exact: true })).toBeVisible();
        await expect(savedPage.getByRole("button", { name: "Edit Get Started", exact: true })).toHaveCount(0);
        const actual = await savedPage.evaluate(() => ({ notes: JSON.parse(localStorage.getItem("notely-notes")), categories: JSON.parse(localStorage.getItem("notely-categories")), trash: JSON.parse(localStorage.getItem("notely-trash")) }));
        expect(actual).toEqual(data);
      } finally { await savedContext.close(); }
    });
    await check("edit, delete, and returning visitor login", async () => {
      await page.getByRole("button", { name: "Edit Short note", exact: true }).click(); await dialog().getByRole("textbox", { name: "Title", exact: true }).fill("Renamed note");
      await dialog().getByRole("button", { name: "Save", exact: true }).click(); await page.getByRole("button", { name: "Edit Renamed note", exact: true }).click(); await dialog().getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page.getByRole("button", { name: "Edit Renamed note", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Account menu", exact: true }).click();
      await page.getByRole("menu").getByText("Log out", { exact: true }).click(); await expect(page).toHaveURL("http://localhost:3000/");
      await expect(page.locator(".login-greeting")).toContainText("Welcome back,"); await shot("phone-login");
    });
    await check("logo and icons load from categorized public assets", async () => {
      expect([...assetRequests]).toContain("/brand/notely-logo.svg");
      expect([...assetRequests].filter((asset) => asset.startsWith("/icons/")).length).toBeGreaterThan(10);
      for (const asset of assetRequests) {
        const response = await page.request.get("http://localhost:3000" + asset);
        expect(response.ok(), asset).toBe(true); expect(response.headers()["content-type"]).toContain("image/svg+xml");
      }
      expect([...externalRequests]).toEqual([]);
      const brokenImages = await page.locator("img").evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src));
      expect(brokenImages).toEqual([]);
    });
    expect(errors).toEqual([]);
    await fs.writeFile(path.join(output, "report.json"), JSON.stringify({ passed: checks, browserErrors: errors, localAssets: [...assetRequests], externalRequests: [...externalRequests] }, null, 2));
    console.log("All " + checks.length + " checks passed. Screenshots: " + output);
  } catch (error) {
    await shot("failure").catch(() => {});
    await fs.writeFile(path.join(output, "report.json"), JSON.stringify({ passed: checks, browserErrors: errors, localAssets: [...assetRequests], externalRequests: [...externalRequests], failure: String(error) }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
