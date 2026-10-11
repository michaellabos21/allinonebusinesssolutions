import { expect, test } from "@playwright/test";

import { addTeammate, startWorkspace } from "./helpers";

/**
 * Notifications end to end: the owner assigns a teammate and comments on the
 * task; the teammate sees both under the bell, opens one, which marks it read
 * and goes to the task, and marks the rest read. The bell's settings link
 * opens the switches, and a switch stays off after a reload.
 */
test("a teammate is notified about an assignment and a comment", async ({ page, browser }) => {
  const { workspace } = await startWorkspace(page, "notify");
  const teammate = await addTeammate(page, browser, workspace, "Rhea Aguilar");
  const main = page.getByRole("main");

  // The owner adds a task, assigns Rhea and comments on it.
  await page.goto("/work/tasks");
  await main.getByRole("button", { name: "New task" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task").fill("Prepare launch post");
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(dialog).toBeHidden();
  await main.getByRole("link", { name: "Prepare launch post" }).click();
  await page.waitForURL(/\/work\/tasks\/[0-9a-f-]{36}$/);
  const taskUrl = page.url();
  await main.getByRole("button", { name: "Assignees: notify Owner" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Rhea Aguilar" }).click();
  await page.keyboard.press("Escape");
  await expect(main.getByRole("button", { name: /^Assignees: .*Rhea Aguilar/ })).toBeVisible();
  await main.getByRole("combobox", { name: "Comment" }).fill("Draft due Friday, thanks!");
  await main.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(main.getByText("Draft due Friday, thanks!")).toBeVisible();

  // The owner's own actions don't notify them.
  await page.reload();
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();

  // Rhea sees both.
  await teammate.reload();
  const bell = teammate.getByRole("button", { name: "Notifications, 2 unread" });
  await expect(bell).toBeVisible();
  await bell.click();
  const menu = teammate.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: /assigned you a task/ })).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: /commented on “Prepare launch post”/ }),
  ).toBeVisible();

  // Opening one goes to the task and marks just that one read.
  await menu.getByRole("menuitem", { name: /assigned you a task/ }).click();
  await teammate.waitForURL(taskUrl);
  await expect(teammate.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();

  // Mark the rest read; it stays read after a reload.
  await teammate.getByRole("button", { name: "Notifications, 1 unread" }).click();
  const markAll = teammate.getByRole("menu").getByRole("button", { name: "Mark all read" });
  // The first request after the click is the save; let it finish before reloading.
  const save = teammate.waitForRequest((request) => request.method() === "POST");
  await markAll.click();
  await (await save).response();
  await expect(markAll).toBeDisabled();
  await teammate.keyboard.press("Escape");
  await expect(teammate.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
  await teammate.reload();
  await expect(teammate.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();

  // The settings link opens the switches; one turned off stays off.
  await teammate.getByRole("button", { name: "Notifications", exact: true }).click();
  await teammate.getByRole("menu").getByRole("link", { name: "Settings" }).click();
  await teammate.waitForURL(/\/settings\?section=notifications$/);
  const comments = teammate.getByRole("switch", { name: "Comments on your tasks" });
  await expect(comments).toBeChecked();
  await comments.click();
  await expect(teammate.getByText("Comments on your tasks: off")).toBeVisible();
  await teammate.reload();
  await expect(teammate.getByRole("switch", { name: "Comments on your tasks" })).not.toBeChecked();
});
