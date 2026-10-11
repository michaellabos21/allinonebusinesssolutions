import { expect, test } from "@playwright/test";

import { PASSWORD, mainNav, signUp, startWorkspace, uniqueEmail } from "./helpers";

test("a signed-out visitor is sent to sign in, and back to where they were going", async ({
  page,
}) => {
  await page.goto("/crm/contacts");
  await expect(page).toHaveURL(/\/login\?next=%2Fcrm%2Fcontacts$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("sign up, create a workspace, sign out and sign back in", async ({ page }) => {
  const { email, workspace } = await startWorkspace(page, "journey");
  await expect(
    page.getByRole("button", { name: new RegExp(`Workspace: ${workspace}`) }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password don’t match an account.")).toBeVisible();

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /welcome back/i })).toBeVisible();
});

test("sign-up rejects bad input and an address that is already registered", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();

  const { email } = await startWorkspace(page, "taken");
  await page.context().clearCookies();
  await signUp(page, { name: "Second Person", email });
  await expect(page.getByText("This email already has an account. Sign in instead.")).toBeVisible();
});

test("workspace settings are saved and survive a reload", async ({ page }) => {
  await startWorkspace(page, "settings");
  await mainNav(page).getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();

  await page.getByLabel("Workspace name").fill("Renamed Studio");
  await page.getByLabel("Payment terms (days)").fill("30");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Workspace settings saved")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: /Workspace: Renamed Studio/ })).toBeVisible();
});

test("invite a teammate, who joins as a member with limited rights", async ({ page, browser }) => {
  const { workspace } = await startWorkspace(page, "inviter");
  const inviteeEmail = uniqueEmail("invitee");

  await mainNav(page).getByRole("link", { name: "Team" }).click();
  await page.getByRole("button", { name: "Invite member" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Work email").fill(inviteeEmail);
  await dialog.getByRole("button", { name: "Create invitation link" }).click();
  const link = await dialog.getByLabel("Invitation link").inputValue();
  expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(inviteeEmail)).toBeVisible();

  // The invited person opens the link in their own browser.
  const context = await browser.newContext();
  const guest = await context.newPage();
  await guest.goto(link);
  await expect(guest.getByRole("heading", { name: `Join ${workspace}` })).toBeVisible();
  await guest.getByRole("link", { name: "Create an account" }).click();
  await expect(guest.getByLabel("Work email")).toHaveValue(inviteeEmail);
  await guest.getByLabel("Full name").fill("Invited Teammate");
  await guest.getByLabel("Password").fill(PASSWORD);
  await guest.getByRole("button", { name: "Create account" }).click();

  await guest.getByRole("button", { name: `Join ${workspace}` }).click();
  await expect(
    guest.getByRole("heading", { level: 1, name: /welcome back, invited/i }),
  ).toBeVisible();

  // A member sees the team but cannot invite or change workspace settings.
  await mainNav(guest).getByRole("link", { name: "Team" }).click();
  await expect(guest.getByText("Invited Teammate")).toBeVisible();
  await expect(guest.getByRole("button", { name: "Invite member" })).toHaveCount(0);
  await mainNav(guest).getByRole("link", { name: "Settings" }).click();
  await guest.getByRole("button", { name: "Workspace", exact: true }).click();
  await expect(
    guest.getByText("Only an owner or admin can change workspace settings."),
  ).toBeVisible();
  await expect(guest.getByLabel("Workspace name")).toBeDisabled();

  // Reopening the link takes the member back into the workspace.
  await guest.goto(link);
  await expect(
    guest.getByRole("heading", { level: 1, name: /welcome back, invited/i }),
  ).toBeVisible();
  await context.close();

  // Nobody else can reuse the link.
  const strangerContext = await browser.newContext();
  const stranger = await strangerContext.newPage();
  await stranger.goto(link);
  await expect(
    stranger.getByRole("heading", { name: "This invitation has already been used" }),
  ).toBeVisible();
  await strangerContext.close();

  // The owner now sees the new member and no pending invitation.
  await page.reload();
  await expect(page.getByText("Invited Teammate")).toBeVisible();
  await expect(page.getByText("No pending invitations")).toBeVisible();
});
