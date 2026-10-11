import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type TestUser,
  addMember,
  admin,
  anonymous,
  cleanUp,
  createUser,
  createWorkspace,
} from "./helpers";

/**
 * Proves the task collaboration rules against a real database: several
 * assignees, the "In review" status, optional due dates, checklists, comments
 * with mentions, and who may change what.
 *
 * Cast: Ana owns workspace A with Max (manager), Mia and Leo (members) and
 * Cleo (client). Ben owns workspace B.
 */
let ana: TestUser, max: TestUser, mia: TestUser, leo: TestUser, cleo: TestUser, ben: TestUser;
let workspaceA: string, workspaceB: string;

async function saveTask(
  user: TestUser,
  fields: Record<string, unknown>,
  assignees: string[] | null = [],
  task: string | null = null,
  workspace = workspaceA,
) {
  return user.client.rpc("save_task", {
    target_workspace: workspace,
    target_task: task,
    fields,
    assignee_ids: assignees,
  });
}
const assigneesOf = async (task: string) =>
  (await admin.from("task_assignees").select("user_id").eq("task_id", task))
    .data!.map((row) => row.user_id)
    .sort();

beforeAll(async () => {
  [ana, max, mia, leo, cleo, ben] = await Promise.all(
    ["ana", "max", "mia", "leo", "cleo", "ben"].map((label) => createUser(`task-${label}`)),
  );
  workspaceA = await createWorkspace(ana, "Tasks A");
  workspaceB = await createWorkspace(ben, "Tasks B");
  await addMember(ana, workspaceA, max, "manager");
  await addMember(ana, workspaceA, mia, "member");
  await addMember(ana, workspaceA, leo, "member");
  await addMember(ana, workspaceA, cleo, "client");
});

afterAll(cleanUp);

describe("saving tasks", () => {
  it("creates a task with several assignees, no due date, and In review", async () => {
    const { data: id, error } = await saveTask(
      ana,
      { title: "Storyboard", status: "in_review", dueOn: null },
      [mia.id, leo.id],
    );
    expect(error).toBeNull();
    const { data: task } = await admin.from("tasks").select("*").eq("id", id).single();
    expect(task!.status).toBe("in_review");
    expect(task!.due_on).toBeNull();
    expect(task!.created_by).toBe(ana.id);
    expect(await assigneesOf(id)).toEqual([mia.id, leo.id].sort());
  });

  it("can leave a task unassigned", async () => {
    const { data: id } = await saveTask(ana, { title: "Someday" }, []);
    expect(await assigneesOf(id)).toEqual([]);
  });

  it("refuses assignees who are clients or outside the workspace", async () => {
    expect((await saveTask(ana, { title: "x" }, [cleo.id])).error?.message).toContain(
      "assignee_not_a_member",
    );
    expect((await saveTask(ana, { title: "x" }, [ben.id])).error?.message).toContain(
      "assignee_not_a_member",
    );
  });

  it("refuses more than 10 assignees", async () => {
    const many = Array.from({ length: 11 }, () => crypto.randomUUID());
    expect((await saveTask(ana, { title: "x" }, many)).error?.message).toContain(
      "too_many_assignees",
    );
  });

  it("changes only the fields given, and the assignees only when given", async () => {
    const { data: id } = await saveTask(ana, { title: "Edit me", priority: "low" }, [mia.id]);
    expect((await saveTask(ana, { priority: "high" }, null, id)).error).toBeNull();
    const { data: task } = await admin.from("tasks").select("*").eq("id", id).single();
    expect(task!.title).toBe("Edit me");
    expect(task!.priority).toBe("high");
    expect(await assigneesOf(id)).toEqual([mia.id]);

    await saveTask(ana, {}, [leo.id], id);
    expect(await assigneesOf(id)).toEqual([leo.id]);
  });
});

describe("who may change a task", () => {
  let task: string;
  beforeAll(async () => {
    task = (await saveTask(ana, { title: "Shared work" }, [mia.id])).data;
  });

  it("lets an assignee change it, and reassign it to someone else entirely", async () => {
    expect((await saveTask(mia, { status: "in_progress" }, null, task)).error).toBeNull();
    // Mia hands it to Leo, removing herself, in one step.
    expect((await saveTask(mia, {}, [leo.id], task)).error).toBeNull();
    expect(await assigneesOf(task)).toEqual([leo.id]);
  });

  it("stops a member who is neither creator nor assignee", async () => {
    const attempt = await saveTask(mia, { title: "Taken over" }, null, task);
    expect(attempt.error?.message).toContain("task_not_editable");
    const add = await mia.client
      .from("task_assignees")
      .insert({ task_id: task, workspace_id: workspaceA, user_id: mia.id });
    expect(add.error).not.toBeNull();
  });

  it("lets a manager change any task", async () => {
    expect((await saveTask(max, { priority: "high" }, [mia.id, leo.id], task)).error).toBeNull();
    expect(await assigneesOf(task)).toEqual([mia.id, leo.id].sort());
  });

  it("hides tasks from clients and other workspaces", async () => {
    for (const user of [cleo, ben]) {
      expect((await user.client.from("tasks").select("id").eq("id", task)).data).toEqual([]);
      expect(
        (await user.client.from("task_assignees").select("task_id").eq("task_id", task)).data,
      ).toEqual([]);
    }
    expect((await saveTask(ben, { title: "x" }, [], task)).error).not.toBeNull();
  });
});

describe("the app before this change", () => {
  it("still saves a single assignee through tasks.assignee_id", async () => {
    const { data } = await ana.client
      .from("tasks")
      .insert({
        workspace_id: workspaceA,
        title: "Old app task",
        due_on: "2026-12-01",
        assignee_id: mia.id,
      })
      .select("id")
      .single();
    expect(await assigneesOf(data!.id)).toEqual([mia.id]);
    await ana.client.from("tasks").update({ assignee_id: leo.id }).eq("id", data!.id);
    expect(await assigneesOf(data!.id)).toEqual([leo.id]);
  });

  it("doesn't reset assignees when only other fields of an old task change", async () => {
    const { data } = await ana.client
      .from("tasks")
      .insert({
        workspace_id: workspaceA,
        title: "Old with extra",
        due_on: "2026-12-01",
        assignee_id: mia.id,
      })
      .select("id")
      .single();
    await ana.client
      .from("task_assignees")
      .insert({ task_id: data!.id, workspace_id: workspaceA, user_id: leo.id });
    expect((await saveTask(ana, { description: "Updated" }, null, data!.id)).error).toBeNull();
    expect(await assigneesOf(data!.id)).toEqual([mia.id, leo.id].sort());
  });
});

describe("checklists", () => {
  let task: string;
  beforeAll(async () => {
    task = (await saveTask(ana, { title: "With steps" }, [mia.id])).data;
  });

  it("lets editors add, tick and remove steps, in order", async () => {
    for (const body of ["Sketch", "Review", "Export"]) {
      const { error } = await mia.client
        .from("task_checklist_items")
        .insert({ workspace_id: workspaceA, task_id: task, body });
      expect(error).toBeNull();
    }
    const { data: items } = await mia.client
      .from("task_checklist_items")
      .select("id, body, position, created_by")
      .eq("task_id", task)
      .order("position");
    expect(items!.map((item) => item.body)).toEqual(["Sketch", "Review", "Export"]);
    expect(items!.every((item) => item.created_by === mia.id)).toBe(true);

    const tick = await mia.client
      .from("task_checklist_items")
      .update({ done: true })
      .eq("id", items![0].id)
      .select("id");
    expect(tick.data).toHaveLength(1);
    const removed = await mia.client
      .from("task_checklist_items")
      .delete()
      .eq("id", items![2].id)
      .select("id");
    expect(removed.data).toHaveLength(1);
  });

  it("stops people who can't edit the task", async () => {
    const insert = await leo.client
      .from("task_checklist_items")
      .insert({ workspace_id: workspaceA, task_id: task, body: "Sneaky" });
    expect(insert.error).not.toBeNull();
    const tick = await leo.client
      .from("task_checklist_items")
      .update({ done: false })
      .eq("task_id", task)
      .select("id");
    expect(tick.data ?? []).toHaveLength(0);
    const moved = await mia.client
      .from("task_checklist_items")
      .update({ task_id: crypto.randomUUID() })
      .eq("task_id", task);
    expect(moved.error).not.toBeNull();
  });
});

describe("comments", () => {
  let task: string;
  beforeAll(async () => {
    task = (await saveTask(ana, { title: "Discuss" }, [mia.id])).data;
  });

  it("lets anyone on the team comment, and keeps only real teammates as mentions", async () => {
    const { data, error } = await leo.client
      .from("task_comments")
      .insert({
        workspace_id: workspaceA,
        task_id: task,
        body: "@Mia can you check this? cc @Cleo @Ben",
        mentions: [mia.id, cleo.id, ben.id, mia.id],
        author_id: ana.id,
      })
      .select("author_id, mentions")
      .single();
    expect(error).toBeNull();
    expect(data!.author_id).toBe(leo.id);
    expect(data!.mentions).toEqual([mia.id]);
  });

  it("lets only the author edit or delete, and a deleted comment loses its text", async () => {
    const { data: comment } = await mia.client
      .from("task_comments")
      .insert({ workspace_id: workspaceA, task_id: task, body: "First draft" })
      .select("id")
      .single();

    const byOther = await ana.client
      .from("task_comments")
      .update({ body: "Rewritten" })
      .eq("id", comment!.id)
      .select("id");
    expect(byOther.data ?? []).toHaveLength(0);

    const edit = await mia.client
      .from("task_comments")
      .update({ body: "Second draft" })
      .eq("id", comment!.id)
      .select("body, edited_at")
      .single();
    expect(edit.data!.body).toBe("Second draft");
    expect(edit.data!.edited_at).not.toBeNull();

    await mia.client
      .from("task_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", comment!.id);
    const { data: gone } = await admin
      .from("task_comments")
      .select("body, deleted_at")
      .eq("id", comment!.id)
      .single();
    expect(gone!.body).toBe("");
    expect(gone!.deleted_at).not.toBeNull();

    const revive = await mia.client
      .from("task_comments")
      .update({ body: "Back" })
      .eq("id", comment!.id);
    expect(revive.error?.message).toContain("comment_deleted");

    const hardDelete = await mia.client.from("task_comments").delete().eq("id", comment!.id);
    expect(hardDelete.error).not.toBeNull();
  });

  it("is closed to clients, other workspaces and visitors", async () => {
    for (const user of [cleo, ben]) {
      const attempt = await user.client
        .from("task_comments")
        .insert({ workspace_id: workspaceA, task_id: task, body: "Hello" });
      expect(attempt.error).not.toBeNull();
      expect(
        (await user.client.from("task_comments").select("id").eq("task_id", task)).data,
      ).toEqual([]);
    }
    const visitor = anonymous();
    expect((await visitor.from("task_comments").select("id")).data ?? []).toEqual([]);
  });
});

describe("history", () => {
  it("records status changes, reassignments and comments against the task", async () => {
    const { data: task } = await saveTask(ana, { title: "Tracked" }, [mia.id]);
    await saveTask(ana, { status: "in_review" }, null, task);
    await saveTask(ana, {}, [leo.id], task);
    await ana.client
      .from("task_comments")
      .insert({ workspace_id: workspaceA, task_id: task, body: "Looks good" });

    const { data } = await admin
      .from("activities")
      .select("summary, href")
      .eq("task_id", task)
      .order("created_at");
    const summaries = data!.map((row) => row.summary);
    expect(summaries[0]).toBe("added task “Tracked”");
    expect(summaries).toContain("moved “Tracked” to In review");
    expect(summaries.some((text) => text.startsWith("assigned "))).toBe(true);
    expect(summaries.some((text) => text.startsWith("unassigned "))).toBe(true);
    expect(summaries).toContain("commented on “Tracked”");
    // Creating with assignees doesn't add separate "assigned" lines.
    expect(summaries.filter((text) => text.startsWith("assigned ")).length).toBe(1);
    expect(data!.every((row) => row.href.startsWith(`/work/tasks/${task}`))).toBe(true);
  });

  it("keeps a workspace's tasks out of another's", async () => {
    const { error } = await saveTask(ben, { title: "Mine" }, [], null, workspaceA);
    expect(error).not.toBeNull();
    expect((await saveTask(ben, { title: "Mine" }, [ben.id], null, workspaceB)).error).toBeNull();
  });
});
