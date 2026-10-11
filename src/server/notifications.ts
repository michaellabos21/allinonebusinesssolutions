import "server-only";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Notification, NotificationFeed, NotificationKind } from "@/mocks/types";

/** How many the bell lists. Older ones still count towards the unread number. */
const FEED_LIMIT = 30;

type Row = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

/**
 * The signed-in user's notifications in a workspace. First asks the database
 * to add any date-based reminders that are now due (tasks due today, overdue
 * invoices); everything else was added when it happened. Row-level security
 * returns only the caller's own.
 *
 * Never throws: a failure here must not take the workspace down with it, so
 * it is logged and the bell shows nothing.
 */
export async function getNotifications(workspaceId: string): Promise<NotificationFeed> {
  const supabase = await createClient();
  const loadedAt = Date.now();

  const refreshed = await supabase.rpc("refresh_notifications", { target_workspace: workspaceId });
  if (refreshed.error) {
    logger.error("notifications.refresh_failed", { code: refreshed.error.code });
  }

  const [list, unread] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, title, body, href, read_at, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(FEED_LIMIT),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .is("read_at", null),
  ]);
  if (list.error || unread.error) {
    logger.error("notifications.load_failed", {
      code: list.error?.code ?? unread.error?.code,
    });
    return { items: [], unread: 0, loadedAt };
  }

  const items: Notification[] = (list.data as Row[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    at: row.created_at,
    read: row.read_at !== null,
  }));
  return { items, unread: unread.count ?? 0, loadedAt };
}
