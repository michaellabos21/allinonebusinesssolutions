"use server";

import { refresh } from "next/cache";

import { FORBIDDEN, context, explain, invalid } from "@/server/action-helpers";
import type { ActionResult } from "@/server/types";
import {
  checklistItemSchema,
  checklistUpdateSchema,
  commentEditSchema,
  commentSchema,
  idSchema,
  taskPatchSchema,
  taskSchema,
  taskStatusSchema,
} from "@/server/validation";

/**
 * Tasks, their assignees, checklists and comments. Who may change what is
 * decided in the database (`private.can_edit_task` and row-level security in
 * supabase/migrations/20261011000006_task_collaboration.sql): managers and
 * above any task, members the tasks they created or are assigned to, and
 * anyone on the team may comment. These actions check the input and report
 * the outcome.
 */

type Saved = { id: string; name: string };

const NOT_YOURS = "You can only change tasks you created or are assigned.";

/** Field names as the database function expects them. */
function toFields(input: {
  title?: string;
  description?: string;
  projectId?: string | null;
  status?: string;
  priority?: string;
  dueOn?: string | null;
}) {
  const fields: Record<string, string | null> = {};
  for (const key of ["title", "description", "projectId", "status", "priority", "dueOn"] as const) {
    if (input[key] !== undefined) fields[key] = input[key];
  }
  return fields;
}

export async function saveTaskAction(input: unknown, id?: string): Promise<ActionResult<Saved>> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (id !== undefined && !idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;

  const { assigneeIds, ...rest } = parsed.data;
  const { data, error } = await ctx.supabase.rpc("save_task", {
    target_workspace: ctx.workspace.id,
    target_task: id ?? null,
    fields: toFields(rest),
    assignee_ids: assigneeIds,
  });
  if (error) return explain(error, "task.save_failed");
  refresh();
  return { ok: true, data: { id: data as string, name: rest.title } };
}

/** Changes only the given fields, and the assignees when `assigneeIds` is given. */
export async function updateTaskAction(
  id: unknown,
  patch: unknown,
): Promise<ActionResult<undefined>> {
  if (!idSchema.safeParse(id).success) return FORBIDDEN;
  const parsed = taskPatchSchema.safeParse(patch);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;

  const { assigneeIds, ...rest } = parsed.data;
  const { error } = await ctx.supabase.rpc("save_task", {
    target_workspace: ctx.workspace.id,
    target_task: id as string,
    fields: toFields(rest),
    assignee_ids: assigneeIds ?? null,
  });
  if (error) return explain(error, "task.update_failed");
  refresh();
  return { ok: true };
}

export async function setTaskStatusAction(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = taskStatusSchema.safeParse(input);
  if (!parsed.success) return FORBIDDEN;
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;

  const { data, error } = await ctx.supabase
    .from("tasks")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error) return explain(error, "task.status_failed");
  if (!data?.length) return { ok: false, error: NOT_YOURS };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export async function addChecklistItemAction(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = checklistItemSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;
  const { error } = await ctx.supabase.from("task_checklist_items").insert({
    workspace_id: ctx.workspace.id,
    task_id: parsed.data.taskId,
    body: parsed.data.body,
  });
  if (error)
    return error.code === "42501"
      ? { ok: false, error: NOT_YOURS }
      : explain(error, "checklist.add_failed");
  refresh();
  return { ok: true };
}

export async function updateChecklistItemAction(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = checklistUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;
  const { id, ...changes } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("task_checklist_items")
    .update(changes)
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error) return explain(error, "checklist.update_failed");
  if (!data?.length) return { ok: false, error: NOT_YOURS };
  refresh();
  return { ok: true };
}

export async function removeChecklistItemAction(id: unknown): Promise<ActionResult<undefined>> {
  if (!idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;
  const { data, error } = await ctx.supabase
    .from("task_checklist_items")
    .delete()
    .eq("id", id as string)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error) return explain(error, "checklist.remove_failed");
  if (!data?.length) return { ok: false, error: NOT_YOURS };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function addCommentAction(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;
  const { error } = await ctx.supabase.from("task_comments").insert({
    workspace_id: ctx.workspace.id,
    task_id: parsed.data.taskId,
    body: parsed.data.body,
    mentions: parsed.data.mentions,
  });
  if (error) return explain(error, "comment.add_failed");
  refresh();
  return { ok: true };
}

export async function editCommentAction(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = commentEditSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;
  const { data, error } = await ctx.supabase
    .from("task_comments")
    .update({ body: parsed.data.body, mentions: parsed.data.mentions })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error) return explain(error, "comment.edit_failed");
  if (!data?.length) return { ok: false, error: "You can only edit your own comments." };
  refresh();
  return { ok: true };
}

export async function deleteCommentAction(id: unknown): Promise<ActionResult<undefined>> {
  if (!idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;
  const { data, error } = await ctx.supabase
    .from("task_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id as string)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error) return explain(error, "comment.delete_failed");
  if (!data?.length) return { ok: false, error: "You can only delete your own comments." };
  refresh();
  return { ok: true };
}
