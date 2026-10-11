import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";

export type ChecklistItem = { id: string; body: string; done: boolean };
export type TaskComment = {
  id: string;
  authorId: string | null;
  authorName: string;
  body: string;
  mentions: string[];
  at: string;
  editedAt: string | null;
  deleted: boolean;
};
export type TaskHistoryEntry = { id: string; actor: string; action: string; at: string };
export type TaskDetail = {
  checklist: ChecklistItem[];
  comments: TaskComment[];
  history: TaskHistoryEntry[];
};

const EMPTY: TaskDetail = { checklist: [], comments: [], history: [] };

/**
 * The parts of a task only its page shows: the whole checklist, the comment
 * thread and the task's history. Loaded as the signed-in user, so row-level
 * security hides everything from anyone who can't see the task.
 */
export async function getTaskDetail(taskId: string): Promise<TaskDetail> {
  const session = await getSession();
  const workspaceId = session?.workspace?.id;
  if (!workspaceId || !/^[0-9a-f-]{36}$/.test(taskId)) return EMPTY;

  const supabase = await createClient();
  const [checklist, comments, history] = await Promise.all([
    supabase
      .from("task_checklist_items")
      .select("id, body, done, position")
      .eq("workspace_id", workspaceId)
      .eq("task_id", taskId)
      .order("position"),
    supabase
      .from("task_comments")
      .select("id, author_id, body, mentions, created_at, edited_at, deleted_at")
      .eq("workspace_id", workspaceId)
      .eq("task_id", taskId)
      .order("created_at")
      .limit(500),
    supabase
      .from("activities")
      .select("id, actor_id, summary, created_at")
      .eq("workspace_id", workspaceId)
      .eq("task_id", taskId)
      .not("summary", "like", "commented on%")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const people = [
    ...new Set(
      [
        ...(comments.data ?? []).map((row) => row.author_id),
        ...(history.data ?? []).map((row) => row.actor_id),
      ].filter(Boolean),
    ),
  ] as string[];
  const { data: profiles } = people.length
    ? await supabase.from("profiles").select("id, full_name").in("id", people)
    : { data: [] };
  const name = new Map((profiles ?? []).map((row) => [row.id, row.full_name as string]));

  return {
    checklist: (checklist.data ?? []).map((row) => ({
      id: row.id,
      body: row.body,
      done: row.done,
    })),
    comments: (comments.data ?? []).map((row) => ({
      id: row.id,
      authorId: row.author_id,
      authorName: (row.author_id && name.get(row.author_id)) || "Former member",
      body: row.body,
      mentions: row.mentions ?? [],
      at: row.created_at,
      editedAt: row.edited_at,
      deleted: row.deleted_at !== null,
    })),
    history: (history.data ?? []).map((row) => ({
      id: row.id,
      actor: (row.actor_id && name.get(row.actor_id)) || "Someone",
      action: row.summary,
      at: row.created_at,
    })),
  };
}
