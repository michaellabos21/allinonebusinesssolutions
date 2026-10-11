import { randomUUID } from "node:crypto";

import { type Page, expect } from "@playwright/test";

export const PASSWORD = "e2e-test-password";

/** A unique address per test run, so tests never collide with each other or earlier runs. */
export const uniqueEmail = (label: string) => `${label}-${randomUUID().slice(0, 8)}@e2e.test`;

export async function signUp(
  page: Page,
  { name, email, path = "/signup" }: { name: string; email: string; path?: string },
) {
  await page.goto(path);
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function createWorkspace(page: Page, name: string) {
  await expect(page.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();
  await page.getByLabel("Business name").fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /welcome back/i })).toBeVisible();
}

/** Signs up a new owner and lands on their workspace's overview. */
export async function startWorkspace(page: Page, label: string) {
  const email = uniqueEmail(label);
  const workspace = `${label} workspace ${randomUUID().slice(0, 4)}`;
  await signUp(page, { name: `${label} Owner`, email });
  await createWorkspace(page, workspace);
  return { email, workspace };
}

export const mainNav = (page: Page) => page.getByRole("navigation", { name: "Main" });
