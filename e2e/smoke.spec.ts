import { expect, test } from "@playwright/test";

/**
 * Smoke test for the prototype: the app loads, navigation works, and a record
 * created through the UI shows up in its list. It runs on demo data, so it
 * will be extended, not replaced, when real persistence arrives.
 */
test("create a contact and find it in the list", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /welcome back/i })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Contacts" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();

  await page.getByRole("main").getByRole("button", { name: "New contact" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Playwright Tester");
  await dialog.getByLabel("Email").fill("tester@smoke.example");
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("searchbox", { name: "Search contacts" }).fill("playwright");
  await expect(page.getByRole("link", { name: "Playwright Tester" })).toBeVisible();
});
