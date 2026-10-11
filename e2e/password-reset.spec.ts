import { expect, test } from "@playwright/test";

import { PASSWORD, startWorkspace } from "./helpers";

/** The local Supabase stack catches outgoing email in Mailpit instead of sending it. */
const MAILPIT = "http://127.0.0.1:54324";

async function latestLinkFor(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const list = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await list.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const message = await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
      const { Text, HTML } = (await message.json()) as { Text: string; HTML: string };
      const link = `${Text}\n${HTML}`.match(/https?:\/\/[^\s"'<>)]+\/auth\/v1\/verify[^\s"'<>)]+/);
      if (link) return link[0].replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No reset email arrived for ${email}`);
}

test("reset a forgotten password by email, then sign in with the new one", async ({ page }) => {
  const { email } = await startWorkspace(page, "reset");
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/a reset link is on its way/)).toBeVisible();

  await page.goto(await latestLinkFor(email));
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();

  const newPassword = "a-brand-new-password";
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Repeat new password").fill("something-else");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("The two passwords don’t match.")).toBeVisible();

  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Repeat new password").fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /welcome back/i })).toBeVisible();

  // The old password no longer works; the new one does.
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password don’t match an account.")).toBeVisible();
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /welcome back/i })).toBeVisible();
});
