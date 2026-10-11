import { expect, test } from "@playwright/test";

import { mainNav, startWorkspace } from "./helpers";

// A 1×1 red PNG; the browser crops and scales it to a 256-pixel square before upload.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);
const photo = { name: "me.png", mimeType: "image/png", buffer: PNG };

/** The width the browser decoded for the first photo matching `selector`, once loaded. */
async function loadedWidth(page: import("@playwright/test").Page, selector: string) {
  const image = page.locator(selector).first();
  await expect(image).toBeVisible();
  return image.evaluate(async (element: HTMLImageElement) => {
    if (!element.complete) await new Promise((resolve) => (element.onload = resolve));
    return element.naturalWidth;
  });
}

/**
 * Profile and contact photos: uploaded through the screens, stored privately,
 * served back through /photos after a reload, and removable.
 */
test("a profile photo and a contact photo are uploaded, shown and removed", async ({ page }) => {
  await startWorkspace(page, "photos");
  const main = page.getByRole("main");

  // Your own photo, from Settings.
  await page.goto("/settings");
  await expect(main.getByRole("button", { name: "Upload photo" })).toBeVisible();
  await main.locator('input[type="file"]').first().setInputFiles(photo);
  await expect(page.getByText("Photo added")).toBeVisible();
  await page.reload();
  expect(await loadedWidth(page, 'main img[src^="/photos/users/"]')).toBe(256);
  // It also replaces the initials in the user menu.
  await expect(page.locator('header img[src^="/photos/users/"]')).toBeVisible();

  // A contact's photo, from the contact's page.
  await mainNav(page).getByRole("link", { name: "Contacts" }).click();
  await page.waitForURL((url) => url.pathname === "/crm/contacts");
  await main.getByRole("button", { name: "New contact" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Rosa Lim");
  await dialog.getByLabel("Email").fill("rosa@photos.example");
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog).toBeHidden();
  await main.getByRole("link", { name: "Rosa Lim" }).click();
  await page.waitForURL(/\/crm\/contacts\/[0-9a-f-]{36}$/);

  await expect(main.getByRole("button", { name: "Add a photo of Rosa Lim" })).toBeVisible();
  await main.locator('input[type="file"]').first().setInputFiles(photo);
  await expect(page.getByText("Photo added")).toBeVisible();
  await page.reload();
  expect(await loadedWidth(page, 'main img[src*="/contacts/"]')).toBe(256);

  // It shows in the contacts list too.
  await mainNav(page).getByRole("link", { name: "Contacts" }).click();
  await page.waitForURL((url) => url.pathname === "/crm/contacts");
  await expect(main.locator('img[src*="/contacts/"]').first()).toBeVisible();

  // And can be removed, back to initials.
  await main.getByRole("link", { name: "Rosa Lim" }).click();
  await page.waitForURL(/\/crm\/contacts\/[0-9a-f-]{36}$/);
  await main.getByRole("button", { name: "Change Rosa Lim’s photo" }).click();
  await page.getByRole("menuitem", { name: "Remove photo" }).click();
  await expect(page.getByText("Photo removed")).toBeVisible();
  await page.reload();
  await expect(main.locator('img[src*="/contacts/"]')).toHaveCount(0);
});

test("a photo can't be fetched without signing in", async ({ browser }) => {
  const visitor = await browser.newContext();
  const response = await visitor.request.get(
    "/photos/users/00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000000.png",
  );
  expect(response.status()).toBe(404);
  await visitor.close();
});
