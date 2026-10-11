import { expect, test } from "@playwright/test";

import { mainNav, startWorkspace } from "./helpers";

/**
 * Phase 2 records end to end: each one is saved through the UI, survives a
 * reload (so it came from the database, not browser memory), and appears in
 * the activity feed.
 */
test("companies, contacts, notes, catalog, projects and tasks persist", async ({ page }) => {
  await startWorkspace(page, "records");
  const main = page.getByRole("main");

  // Company
  await mainNav(page).getByRole("link", { name: "Companies" }).click();
  await page.waitForURL((url) => url.pathname === "/crm/companies");
  await main.getByRole("button", { name: "New company" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Company name").fill("Harbor Bakery");
  await dialog.getByRole("button", { name: "Add company" }).click();
  await expect(dialog).toBeHidden();

  // Contact linked to the company, then a note on it
  await mainNav(page).getByRole("link", { name: "Contacts" }).click();
  await page.waitForURL((url) => url.pathname === "/crm/contacts");
  await main.getByRole("button", { name: "New contact" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Rosa Lim");
  await dialog.getByLabel("Email").fill("rosa@harbor.example");
  await dialog.getByRole("combobox", { name: /^Company/ }).fill("Harbor Bakery");
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await main.getByRole("link", { name: "Rosa Lim" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rosa Lim" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Harbor Bakery" }).first()).toBeVisible();
  // Before the page's script has loaded, submitting does a plain form post that
  // reloads the page and loses the text, so retry until the note appears.
  await expect(async () => {
    await main.getByRole("textbox", { name: /note/i }).fill("Prefers email in the morning.");
    await main.getByRole("button", { name: /add note/i }).click();
    await expect(page.getByText("Note added")).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });
  await expect(main.getByText("Prefers email in the morning.").first()).toBeVisible();
  await page.reload();
  await expect(main.getByText("Prefers email in the morning.").first()).toBeVisible();

  // Duplicate email is refused
  await mainNav(page).getByRole("link", { name: "Contacts" }).click();
  await page.waitForURL((url) => url.pathname === "/crm/contacts");
  await main.getByRole("button", { name: "New contact" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Rosa Again");
  await dialog.getByLabel("Email").fill("rosa@harbor.example");
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog.getByText(/already/i).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // Catalog item
  await mainNav(page).getByRole("link", { name: "Products & Services" }).click();
  await page.waitForURL((url) => url.pathname === "/catalog");
  await main
    .getByRole("button", { name: /new item/i })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Logo design");
  await dialog.getByLabel("Unit", { exact: true }).fill("logo");
  await dialog.getByLabel(/price/i).fill("4500");
  await dialog.getByRole("button", { name: "Add item" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(main.getByText("Logo design").first()).toBeVisible();

  // Project, then a task in it, then complete the task
  await mainNav(page).getByRole("link", { name: "Projects" }).click();
  await page.waitForURL((url) => url.pathname === "/work/projects");
  await main.getByRole("button", { name: "New project" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill("Bakery rebrand");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await main.getByRole("link", { name: "Bakery rebrand" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Bakery rebrand" })).toBeVisible();
  await main
    .getByRole("button", { name: /add task|new task/i })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task").fill("Draft three logo options");
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(dialog).toBeHidden();

  await mainNav(page).getByRole("link", { name: "Tasks" }).click();
  await page.waitForURL((url) => url.pathname === "/work/tasks");
  await expect(
    main.getByRole("button", { name: "Draft three logo options", exact: true }),
  ).toBeVisible();
  await main.getByRole("checkbox", { name: /draft three logo options/i }).click();
  await expect(page.getByText("Task completed")).toBeVisible();
  await page.reload();
  // Done tasks drop out of the default "Open" view; the count proves it was saved.
  await expect(main.getByText(/^0 open, \d+ overdue/)).toBeVisible();

  // Activity feed on the overview names the real actor
  await mainNav(page).getByRole("link", { name: "Overview" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(main.getByText("started project “Bakery rebrand”").first()).toBeVisible();
  await expect(main.getByText("completed “Draft three logo options”").first()).toBeVisible();
});

test("import contacts from a CSV file with a preview and row errors", async ({ page }) => {
  await startWorkspace(page, "import");
  const main = page.getByRole("main");

  await mainNav(page).getByRole("link", { name: "Contacts" }).click();
  await page.waitForURL((url) => url.pathname === "/crm/contacts");
  await main.getByRole("button", { name: "Import CSV" }).click();
  const dialog = page.getByRole("dialog");

  const csv = [
    "Full Name,E-mail,Company,Status,Tags",
    "Lena Park,lena@park.example,Park Studio,lead,VIP;Referral",
    'Omar Diaz,omar@diaz.example,"Diaz, Inc.",,',
    "No Email,,Nowhere,,",
    "Lena Twin,LENA@park.example,,,",
  ].join("\n");
  await dialog.getByLabel("CSV file").setInputFiles({
    name: "contacts.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });

  await expect(dialog.getByText(/2\s+of 4 rows/)).toBeVisible();
  await expect(dialog.getByText("Line 4:")).toBeVisible();
  await expect(dialog.getByText("Same email as line 2.")).toBeVisible();
  await dialog.getByRole("button", { name: "Import 2 contacts" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(main.getByRole("link", { name: "Lena Park" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Omar Diaz" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Diaz, Inc." })).toBeVisible();
});
