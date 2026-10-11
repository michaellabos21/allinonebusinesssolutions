import { expect, test } from "@playwright/test";

import { mainNav, startWorkspace } from "./helpers";

const BILL_TO_REQUIRED = "Choose who the document is for before issuing it.";

/**
 * Phase 4 end to end: an estimate is sent, accepted and turned into an
 * invoice, which is issued with a number, part paid, refused an overpayment
 * and then paid in full. Another invoice is voided, and an expense is
 * recorded and archived. Reloads prove the figures came from the database.
 */
test("an accepted estimate becomes an invoice that is issued and paid", async ({ page }) => {
  await startWorkspace(page, "finance");
  const main = page.getByRole("main");

  // A client to bill.
  await mainNav(page).getByRole("link", { name: "Contacts" }).click();
  await page.waitForURL((url) => url.pathname === "/crm/contacts");
  await main.getByRole("button", { name: "New contact" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Lea Santos");
  await dialog.getByLabel("Email").fill("lea@santos.example");
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog).toBeHidden();

  // An estimate with a fractional quantity and 12% tax:
  // 1.5 × 2,500 + 2 × 1,000 = 5,750, plus 690 tax = 6,440.
  await mainNav(page).getByRole("link", { name: "Estimates" }).click();
  await page.waitForURL((url) => url.pathname === "/money/estimates");
  await main.getByRole("link", { name: "New estimate" }).first().click();
  await page.waitForURL((url) => url.pathname === "/money/estimates/new");
  await main.getByRole("combobox", { name: "Client" }).click();
  await page.getByRole("option", { name: /Lea Santos/ }).click();
  await main.getByLabel("Description").first().fill("Design hours");
  await main.getByLabel("Qty").first().fill("1.5");
  await main.getByLabel("Unit price").first().fill("2500");
  await main.getByRole("button", { name: "Add line" }).click();
  await main.getByLabel("Description").nth(1).fill("Print proofs");
  await main.getByLabel("Qty").nth(1).fill("2");
  await main.getByLabel("Unit price").nth(1).fill("1000");
  await main.getByRole("combobox", { name: "Tax" }).click();
  await page.getByRole("option", { name: /12%/ }).click();
  await expect(main.getByLabel("Totals")).toContainText("₱6,440");
  await main.getByRole("button", { name: "Save draft" }).click();

  await page.waitForURL(/\/money\/estimates\/[0-9a-f-]{36}$/);
  await expect(main.getByRole("heading", { name: "Draft estimate" })).toBeVisible();
  await main.getByRole("button", { name: "Mark as sent" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Mark as sent" }).click();
  await expect(main.getByRole("heading", { name: "EST-0001" })).toBeVisible();

  await main.getByRole("button", { name: "Accepted" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Mark accepted" }).click();
  await expect(main.getByText("Accepted by the client.")).toBeVisible();
  await main.getByRole("button", { name: "Create invoice" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Create draft invoice" }).click();

  // The draft invoice carries the estimate's lines and the server's totals.
  await page.waitForURL(/\/money\/invoices\/[0-9a-f-]{36}$/);
  await expect(main.getByRole("heading", { name: "Draft invoice" })).toBeVisible();
  const document = main.getByRole("article");
  await expect(document).toContainText("Design hours");
  await expect(document).toContainText("1.5");
  await expect(document).toContainText("₱6,440");

  await main.getByRole("button", { name: "Issue invoice" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Issue invoice" }).click();
  await expect(main.getByRole("heading", { name: "INV-0001" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Print or save PDF" })).toBeVisible();

  // A part payment, then an overpayment is refused.
  await main.getByRole("button", { name: "Record payment" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Amount/).fill("2000");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(main.getByText("Part paid")).toBeVisible();
  await expect(main.getByText(/₱4,440 still owed/)).toBeVisible();

  await main.getByRole("button", { name: "Record payment" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Amount/).fill("5000");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog.getByText(/is owed/)).toBeVisible();
  await dialog.getByLabel(/^Amount/).fill("4440");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(main.getByText(/^Paid in full/)).toBeVisible();

  // Reports count the money as collected.
  await mainNav(page).getByRole("link", { name: "Reports" }).click();
  await page.waitForURL((url) => url.pathname === "/reports");
  const headline = main.getByRole("region", { name: "Headline figures" });
  await expect(headline).toContainText("₱6,440");
});

test("an issued invoice can be voided, and expenses are archived, not deleted", async ({
  page,
}) => {
  await startWorkspace(page, "void");
  const main = page.getByRole("main");

  // A one-line invoice without a client can be saved as a draft but not issued.
  await mainNav(page).getByRole("link", { name: "Invoices" }).click();
  await page.waitForURL((url) => url.pathname === "/money/invoices");
  await main.getByRole("link", { name: "New invoice" }).first().click();
  await page.waitForURL((url) => url.pathname === "/money/invoices/new");
  await main.getByLabel("Description").first().fill("Consulting");
  await main.getByLabel("Unit price").first().fill("1500");
  await main.getByRole("button", { name: "Save draft" }).click();
  await page.waitForURL(/\/money\/invoices\/[0-9a-f-]{36}$/);
  await main.getByRole("button", { name: "Issue invoice" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Issue invoice" }).click();
  await expect(page.getByText(BILL_TO_REQUIRED)).toBeVisible();
  await expect(main.getByRole("heading", { name: "Draft invoice" })).toBeVisible();

  // Add a client, choose it on the draft, and issue.
  await mainNav(page).getByRole("link", { name: "Contacts" }).click();
  await page.waitForURL((url) => url.pathname === "/crm/contacts");
  await main.getByRole("button", { name: "New contact" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Noel Reyes");
  await dialog.getByLabel("Email").fill("noel@reyes.example");
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog).toBeHidden();

  await mainNav(page).getByRole("link", { name: "Invoices" }).click();
  await page.waitForURL((url) => url.pathname === "/money/invoices");
  await main.getByRole("button", { name: "Actions for draft invoice" }).click();
  await page.getByRole("menuitem", { name: "Edit draft" }).click();
  await page.waitForURL(/\/edit$/);
  await main.getByRole("combobox", { name: "Client" }).click();
  await page.getByRole("option", { name: /Noel Reyes/ }).click();
  await main.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/\/money\/invoices\/[0-9a-f-]{36}$/);
  await main.getByRole("button", { name: "Issue invoice" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Issue invoice" }).click();
  await expect(main.getByRole("heading", { name: "INV-0001" })).toBeVisible();

  // Voiding needs a reason, and keeps the number.
  await main.getByRole("button", { name: "Void" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Void invoice" }).click();
  await expect(dialog.getByText("Say why the invoice is being voided.")).toBeVisible();
  await dialog.getByLabel("Reason").fill("Billed the wrong client");
  await dialog.getByRole("button", { name: "Void invoice" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(main.getByText("Voided: Billed the wrong client")).toBeVisible();
  await expect(main.getByRole("heading", { name: "INV-0001" })).toBeVisible();

  // An expense, then archived: it leaves the list but is kept.
  await mainNav(page).getByRole("link", { name: "Expenses" }).click();
  await page.waitForURL((url) => url.pathname === "/money/expenses");
  await main.getByRole("button", { name: "New expense" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Paid to").fill("Panay Print House");
  await dialog.getByLabel(/^Amount/).fill("1250.50");
  await dialog.getByRole("combobox", { name: "Category" }).click();
  await page.getByRole("option").first().click();
  await dialog.getByLabel("What it was for").fill("Proof prints");
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(main.getByText("Panay Print House")).toBeVisible();
  await expect(main.getByText("1,250.50").first()).toBeVisible();

  await main.getByRole("button", { name: "Actions for the Panay Print House expense" }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archive expense" }).click();
  await expect(page.getByText("Expense from Panay Print House archived")).toBeVisible();
  await page.reload();
  await expect(main.getByText("Panay Print House")).toBeHidden();
  await main.getByRole("button", { name: /^Show/ }).click();
  await page.getByRole("menuitemradio", { name: "Archived" }).click();
  await expect(main.getByText("Panay Print House")).toBeVisible();
});
