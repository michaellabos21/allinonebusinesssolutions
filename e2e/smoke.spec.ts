import { expect, test } from "@playwright/test";

import { mainNav, startWorkspace } from "./helpers";

/**
 * Checks the business screens work for a signed-in user: navigation, and a
 * record created through the UI showing up in its list.
 */
test("create a contact and find it in the list", async ({ page }) => {
  await startWorkspace(page, "smoke");

  await mainNav(page).getByRole("link", { name: "Contacts" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Contacts" })).toBeVisible();

  await page.getByRole("main").getByRole("button", { name: "New contact" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Playwright Tester");
  await dialog.getByLabel("Email").fill("tester@smoke.example");
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("searchbox", { name: "Search contacts" }).fill("playwright");
  await expect(page.getByRole("link", { name: "Playwright Tester" })).toBeVisible();
});
