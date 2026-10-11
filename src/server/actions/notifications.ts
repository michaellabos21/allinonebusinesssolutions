"use server";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { NotificationFeed } from "@/mocks/types";
import { getNotifications } from "@/server/notifications";
import { getSession } from "@/server/session";
import type { ActionResult } from "@/server/types";
import { idSchema } from "@/server/validation";

/**
 * The bell's actions. Each works on the signed-in user's own notifications in
 * their active workspace; row-level security refuses anyone else's.
 */

/** The latest feed, for the bell to check for new notifications. */
export async function loadNotificationsAction(): Promise<NotificationFeed | null> {
  const session = await getSession();
  if (!session?.workspace) return null;
  return getNotifications(session.workspace.id);
}

export async function markNotificationReadAction(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "That notification doesn’t exist." };
  return markRead(parsed.data);
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  return markRead(null);
}

async function markRead(id: string | null): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.workspace) return { ok: false, error: "Your session has ended. Sign in again." };
  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", session.workspace.id)
    .eq("user_id", session.user.id)
    .is("read_at", null);
  if (id) query = query.eq("id", id);
  const { error } = await query;
  if (error) {
    logger.error("notifications.mark_read_failed", { code: error.code });
    return { ok: false, error: "We couldn’t mark that as read. Try again." };
  }
  return { ok: true };
}
