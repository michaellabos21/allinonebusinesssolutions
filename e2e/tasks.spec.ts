import { expect, test } from "@playwright/test";

import { addTeammate, mainNav, startWorkspace } from "./helpers";

/**
 * ClickUp-style tasks: quick add into a status group, a task page with
 * several assignees, a checklist and a comment thread with @mentions, and a
 * board whose cards move between columns. Reloads prove each change was
 * saved; a teammate's view proves comments and assignments are shared.
 */
test("a task is planned, assigned, discussed and moved", async ({ page, browser }) => {
  const { workspace } = await startWorkspace(page, "tasks");
  const teammate = await addTeammate(page, browser, workspace, "Rhea Aguilar");
  const main = page.getByRole("main");

  // Quick add straight into the In progress group.
  await page.goto("/work/tasks");
  await main.getByRole("button", { name: "New task" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task").fill("Pick brand fonts");
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(dialog).toBeHidden();

  const inProgress = main.getByRole("region", { name: /^In progress/ });
  await inProgress.getByRole("button", { name: "Add task" }).click();
  await inProgress.getByLabel("New task in In progress").fill("Design homepage hero");
  await inProgress.getByLabel("New task in In progress").press("Enter");
  await expect(inProgress.getByRole("link", { name: "Design homepage hero" })).toBeVisible();

  // The task page.
  await inProgress.getByRole("link", { name: "Design homepage hero" }).click();
  await page.waitForURL(/\/work\/tasks\/[0-9a-f-]{36}$/);
  await expect(main.getByLabel("Task name")).toHaveValue("Design homepage hero");

  // Two assignees.
  await main.getByRole("button", { name: "Assignees: none" }).click();
  await page.getByRole("menuitemcheckbox", { name: /tasks Owner/ }).click();
  await page.getByRole("menuitemcheckbox", { name: "Rhea Aguilar" }).click();
  await page.keyboard.press("Escape");
  await expect(main.getByRole("button", { name: /^Assignees: .*Rhea Aguilar/ })).toBeVisible();

  // Status, due date and a description.
  await main.getByRole("button", { name: "Status: In progress" }).click();
  await page.getByRole("menuitemradio", { name: "In review" }).click();
  await main.getByLabel("Due date", { exact: true }).fill("2026-12-15");
  await main.getByLabel("Description").fill("Hero image, headline and one call to action.");
  await main.getByRole("button", { name: "Save description" }).click();
  await expect(page.getByText("Description saved")).toBeVisible();

  // A checklist.
  for (const step of ["Moodboard", "Three sketches", "Client review"]) {
    await main.getByLabel("New checklist item").fill(step);
    await main.getByRole("button", { name: "Add", exact: true }).click();
    await expect(main.getByText(step, { exact: true })).toBeVisible();
  }
  await main.getByRole("checkbox", { name: "Moodboard" }).check();
  await expect(main.getByText("1 of 3 done")).toBeVisible();

  // A comment that mentions the teammate, picked from the @ list.
  const box = main.getByRole("combobox", { name: "Comment" });
  await box.fill("Draft is ready, @Rh");
  await page.getByRole("option", { name: "Rhea Aguilar" }).click();
  await box.pressSequentially("can you review?");
  await main.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(main.getByText("can you review?")).toBeVisible();

  await page.reload();
  await expect(main.getByRole("button", { name: "Status: In review" })).toBeVisible();
  await expect(main.getByLabel("Due date", { exact: true })).toHaveValue("2026-12-15");
  await expect(main.getByText("1 of 3 done")).toBeVisible();
  const mention = main.locator("span", { hasText: "@Rhea Aguilar" });
  await expect(mention).toBeVisible();
  await expect(main.getByText("moved “Design homepage hero” to In review")).toBeVisible();

  // The teammate sees it as theirs, replies, and can't edit the owner's comment.
  const taskUrl = page.url();
  await teammate.goto("/work/tasks");
  await teammate.getByRole("button", { name: /^Assignee/ }).click();
  await teammate.getByRole("menuitemradio", { name: "Me" }).click();
  await expect(teammate.getByRole("link", { name: "Design homepage hero" })).toBeVisible();
  await expect(teammate.getByRole("link", { name: "Pick brand fonts" })).toHaveCount(0);
  await teammate.goto(taskUrl);
  const theirMain = teammate.getByRole("main");
  await expect(theirMain.getByText("can you review?")).toBeVisible();
  await expect(theirMain.getByRole("button", { name: "Comment options" })).toHaveCount(0);
  await theirMain.getByRole("combobox", { name: "Comment" }).fill("Looks great, approved.");
  await theirMain.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(theirMain.getByText("Looks great, approved.")).toBeVisible();
  await theirMain.getByRole("checkbox", { name: "Three sketches" }).check();
  await expect(theirMain.getByText("2 of 3 done")).toBeVisible();

  // The owner edits, then deletes, their own comment.
  await page.reload();
  await expect(main.getByText("Looks great, approved.")).toBeVisible();
  await main.getByRole("button", { name: "Comment options" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await main.getByRole("combobox", { name: "Edit comment" }).fill("Final draft is ready.");
  await main.getByRole("button", { name: "Save", exact: true }).click();
  await expect(main.getByText("Final draft is ready.")).toBeVisible();
  await expect(main.getByText("(edited)")).toBeVisible();
  await main.getByRole("button", { name: "Comment options" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete comment" }).click();
  await expect(main.getByText("This comment was deleted.")).toBeVisible();

  // On the board, the card shows its progress and moves to Done.
  await page.goto("/work/tasks");
  await main.getByRole("button", { name: "Board" }).click();
  const review = main.getByRole("region", { name: /^In review/ });
  const card = review.getByRole("listitem").filter({ hasText: "Design homepage hero" });
  await expect(card.getByText("2/3")).toBeVisible();
  await card.getByRole("button", { name: /Move “Design homepage hero”/ }).click();
  await page.getByRole("menuitemradio", { name: "Done" }).click();
  await expect(page.getByText("Moved to Done")).toBeVisible();
  await page.reload();
  await main.getByRole("button", { name: "Board" }).click();
  await expect(
    main.getByRole("region", { name: /^Done/ }).getByRole("link", { name: "Design homepage hero" }),
  ).toBeVisible();

  // Dragging works too.
  const todoCard = main
    .getByRole("region", { name: /^To do/ })
    .getByRole("listitem")
    .filter({ hasText: "Pick brand fonts" });
  await todoCard.dragTo(main.getByRole("region", { name: /^In progress/ }));
  await expect(
    main
      .getByRole("region", { name: /^In progress/ })
      .getByRole("link", { name: "Pick brand fonts" }),
  ).toBeVisible();

  await teammate.context().close();
});

test("a project page lists and adds its own tasks", async ({ page }) => {
  await startWorkspace(page, "projtasks");
  const main = page.getByRole("main");
  await mainNav(page).getByRole("link", { name: "Projects" }).click();
  await page.waitForURL((url) => url.pathname === "/work/projects");
  await main.getByRole("button", { name: "New project" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill("Website relaunch");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog).toBeHidden();
  await main.getByRole("link", { name: "Website relaunch" }).first().click();
  await page.waitForURL(/\/work\/projects\/[0-9a-f-]{36}$/);

  const todo = main.getByRole("region", { name: /^To do/ });
  await todo.getByRole("button", { name: "Add task" }).click();
  await todo.getByLabel("New task in To do").fill("Write page copy");
  await todo.getByLabel("New task in To do").press("Enter");
  await expect(todo.getByRole("link", { name: "Write page copy" })).toBeVisible();

  // It belongs to the project everywhere.
  await page.goto("/work/tasks");
  await expect(main.getByText("Website relaunch").first()).toBeVisible();
  await main.getByRole("link", { name: "Write page copy" }).click();
  await expect(main.getByRole("combobox", { name: "Project" })).toHaveText(/Website relaunch/);
});
