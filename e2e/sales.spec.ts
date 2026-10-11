import { expect, test } from "@playwright/test";

import { mainNav, startWorkspace } from "./helpers";

/**
 * Phase 3 end to end: a lead becomes a contact and a deal, the deal moves
 * through the pipeline and is lost with a reason, and a public form creates a
 * lead without anyone signing in. Reloads prove the data came from the database.
 */
test("a lead converts into a contact and a deal that moves through the pipeline", async ({
  page,
}) => {
  await startWorkspace(page, "sales");
  const main = page.getByRole("main");

  await mainNav(page).getByRole("link", { name: "Leads" }).click();
  await main.getByRole("button", { name: "New lead" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Rafael Ocampo");
  await dialog.getByLabel("Email").fill("rafael@ocampo.example");
  await dialog.getByLabel("Company").fill("Ocampo Builds");
  await dialog.getByRole("button", { name: "Add lead" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await main.getByRole("button", { name: "Convert Rafael Ocampo" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Deal name").fill("Ocampo rebrand");
  await dialog.getByLabel(/^Value/).fill("85000");
  await dialog.getByRole("button", { name: "Convert lead" }).click();
  await expect(page.getByText("Rafael Ocampo converted")).toBeVisible();

  // The contact and company now exist.
  await mainNav(page).getByRole("link", { name: "Contacts" }).click();
  await expect(main.getByRole("link", { name: "Rafael Ocampo" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Ocampo Builds" })).toBeVisible();

  // The deal is on the board, in the first stage.
  await mainNav(page).getByRole("link", { name: "Deals" }).click();
  const discovery = main.getByRole("region", { name: /^Discovery/ });
  await expect(
    discovery.getByRole("button", { name: "Ocampo rebrand", exact: true }),
  ).toBeVisible();

  // Move it with the keyboard-friendly menu, then check it stayed after a reload.
  await main.getByRole("button", { name: "Move Ocampo rebrand to another stage" }).click();
  await page.getByRole("menuitemradio", { name: "Proposal" }).click();
  await expect(page.getByText("“Ocampo rebrand” moved to Proposal")).toBeVisible();
  await page.reload();
  await expect(
    main
      .getByRole("region", { name: /^Proposal/ })
      .getByRole("button", { name: "Ocampo rebrand", exact: true }),
  ).toBeVisible();

  // Losing it asks for a reason.
  await main.getByRole("button", { name: "Move Ocampo rebrand to another stage" }).click();
  await page.getByRole("menuitemradio", { name: "Lost" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Mark as lost" }).click();
  await expect(dialog.getByText("Say why the deal was lost.")).toBeVisible();
  await dialog.getByLabel("Reason lost").fill("Budget moved to next year");
  await dialog.getByRole("button", { name: "Mark as lost" }).click();
  await expect(page.getByText("“Ocampo rebrand” marked as lost")).toBeVisible();

  // Its history lists every change.
  await main.getByRole("button", { name: "Table" }).click();
  await main.getByRole("button", { name: /^Status:/ }).click();
  await page.getByRole("menuitemradio", { name: "Lost" }).click();
  await main.getByRole("button", { name: "Ocampo rebrand", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Budget moved to next year").first()).toBeVisible();
  await expect(sheet.getByText(/moved “Ocampo rebrand” to Proposal/)).toBeVisible();
  await expect(sheet.getByText(/lost the deal “Ocampo rebrand”: Budget moved/)).toBeVisible();
});

test("a public lead form creates a lead without signing in", async ({ page, browser }) => {
  await startWorkspace(page, "forms");
  const main = page.getByRole("main");

  await mainNav(page).getByRole("link", { name: "Lead forms" }).click();
  await main.getByRole("button", { name: "New form" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Form name").fill("Website enquiry");
  await dialog.getByLabel(/Consent checkbox text/).fill("I agree to be contacted.");
  await dialog.getByRole("button", { name: "Create form" }).click();
  await expect(dialog).toBeHidden();
  const href = await main.getByRole("link", { name: /^Open/ }).getAttribute("href");
  expect(href).toMatch(/^\/f\/[0-9a-f]{36}$/);

  // A visitor with no account.
  const visitor = await browser.newContext();
  const form = await visitor.newPage();
  await form.goto(href!);
  await expect(form.getByRole("heading", { name: "Website enquiry" })).toBeVisible();
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByText("Tick the box to continue.")).toBeVisible();
  await form.getByLabel("Your name").fill("Nina Santos");
  await form.getByLabel("Email").fill("nina@santos.example");
  await form.getByLabel(/How can we help/).fill("A logo and a one-page site.");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByText("Message sent")).toBeVisible();

  // An unknown link shows a plain message.
  await form.goto("/f/0123456789abcdef0123456789abcdef0123");
  await expect(form.getByText("This form isn’t available")).toBeVisible();
  await visitor.close();

  await page.goto("/crm/leads");
  const row = main.getByRole("row", { name: /Nina Santos/ });
  await expect(row).toBeVisible();
  await expect(row.getByText("Form: Website enquiry")).toBeVisible();
  await expect(row.getByText("Unassigned")).toBeVisible();
});
