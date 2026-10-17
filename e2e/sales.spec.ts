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

test("a lead form with its own questions, look and embed code records answers and campaign", async ({
  page,
  browser,
}) => {
  await startWorkspace(page, "form-builder");
  const main = page.getByRole("main");

  await mainNav(page).getByRole("link", { name: "Lead forms" }).click();
  await main.getByRole("button", { name: "New form" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Form name").fill("Quote request");

  // A required dropdown and an optional set of checkboxes, after the built-in questions.
  await dialog.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("menuitem", { name: "Dropdown" }).click();
  await dialog.getByRole("textbox", { name: "Question 6", exact: true }).fill("Budget");
  await dialog.getByLabel("Choices, one per line").fill("Under ₱50,000\n₱50,000 to ₱150,000");
  await dialog.getByRole("checkbox", { name: "Required" }).nth(5).check();
  await dialog.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("menuitem", { name: "Checkboxes" }).click();
  await dialog.getByRole("textbox", { name: "Question 7", exact: true }).fill("Services");
  await dialog.getByLabel("Choices, one per line").nth(1).fill("Logo\nWebsite\nPrinting");
  // Company isn’t needed for quotes.
  await dialog.getByRole("button", { name: "Remove question 4" }).click();

  // A colour too light for white text is refused before saving.
  await dialog.getByLabel("Button colour, as a hex code").fill("#ffee88");
  await expect(dialog.getByText("Pick a darker colour")).toBeVisible();
  await dialog.getByRole("button", { name: "Use #0f6b66" }).click();
  await dialog.getByLabel("Button text").fill("Request a quote");
  await dialog.getByRole("button", { name: "Create form" }).click();
  await expect(dialog).toBeHidden();

  await main.getByRole("button", { name: /^Embed/ }).click();
  const code = await page.getByLabel("Embed code").inputValue();
  expect(code).toMatch(/\/f\/[0-9a-f]{36}\?embed=1&page=/);
  await page.getByRole("button", { name: "Close" }).first().click();
  const href = await main.getByRole("link", { name: /^Open/ }).getAttribute("href");

  // A visitor arrives from a tagged campaign link.
  const visitor = await browser.newContext();
  const form = await visitor.newPage();
  await form.goto(`${href}?utm_source=facebook&utm_campaign=october`);
  await expect(form.getByRole("heading", { name: "Quote request" })).toBeVisible();
  await expect(form.getByLabel("Company (optional)")).toHaveCount(0);
  const send = form.getByRole("button", { name: "Request a quote" });
  await expect(send).toHaveCSS("background-color", "rgb(15, 107, 102)");
  await form.getByLabel("Your name").fill("Paolo Reyes");
  await form.getByLabel("Email").fill("paolo@reyes.example");
  await send.click();
  await expect(form.getByText("Choose one.")).toBeVisible();
  await form.getByLabel("Budget").selectOption("₱50,000 to ₱150,000");
  await form.getByRole("checkbox", { name: "Logo" }).check();
  await form.getByRole("checkbox", { name: "Printing" }).check();
  await send.click();
  await expect(form.getByText("Message sent")).toBeVisible();

  // The same form shown on a website through the embed code.
  await form.goto(
    `${href}?embed=1&page=${encodeURIComponent("https://reyes.example/contact?utm_source=google")}`,
  );
  await expect(form.getByRole("heading", { name: "Quote request" })).toBeVisible();
  await expect(form.locator("main")).not.toHaveClass(/rounded-lg/);
  await visitor.close();

  await page.goto("/crm/leads");
  const row = main.getByRole("row", { name: /Paolo Reyes/ });
  await expect(row.getByText("via facebook / october")).toBeVisible();
  await row.getByRole("button", { name: "Actions for Paolo Reyes" }).click();
  await page.getByRole("menuitem", { name: "View enquiry" }).click();
  const enquiry = page.getByRole("dialog");
  await expect(enquiry.getByText("₱50,000 to ₱150,000")).toBeVisible();
  await expect(enquiry.getByText("Logo, Printing")).toBeVisible();
  await expect(enquiry.getByText("october")).toBeVisible();
  await enquiry.getByRole("button", { name: "Close" }).first().click();

  // One view (a browser tab counts once, link and embed alike) and one lead in the last 30 days.
  await page.goto("/crm/forms");
  const stats = main.getByLabel("Quote request, last 30 days").getByRole("definition");
  await expect(stats).toHaveText(["1", "1", "100%"]);
  await main.getByRole("link", { name: /View leads/ }).click();
  await expect(main.getByRole("row", { name: /Paolo Reyes/ })).toBeVisible();
});

test("a manager deletes a lead for good", async ({ page }) => {
  await startWorkspace(page, "delete-lead");
  const main = page.getByRole("main");

  await mainNav(page).getByRole("link", { name: "Leads" }).click();
  await main.getByRole("button", { name: "New lead" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Spam Sender");
  await dialog.getByRole("button", { name: "Add lead" }).click();
  await expect(dialog).toBeHidden();

  await main.getByRole("button", { name: "Actions for Spam Sender" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm.getByText("can’t be restored")).toBeVisible();
  await confirm.getByRole("button", { name: "Delete lead" }).click();
  await expect(page.getByText("Spam Sender deleted")).toBeVisible();

  await page.reload();
  await expect(main.getByRole("row", { name: /Spam Sender/ })).toHaveCount(0);
  // Not hidden in the archive either: it is gone.
  await expect(page.getByText("No leads yet")).toBeVisible();
});
