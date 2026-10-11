"use server";

import { refresh } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/session";
import type { ActionResult } from "@/server/types";
import {
  NOTIFICATION_COLUMNS,
  fieldErrorsOf,
  notificationPrefSchema,
  preferencesSchema,
  profileSchema,
} from "@/server/validation";

/** Updates the signed-in user's own profile row. The id always comes from the session. */
async function updateOwnProfile(
  values: Record<string, string | number | boolean>,
  event: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session has ended. Sign in again." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(values)
    .eq("id", session.user.id)
    .select("id");
  if (error || !data?.length) {
    logger.error(event, { code: error?.code ?? "no_rows" });
    return { ok: false, error: "We couldn’t save that. Try again." };
  }
  refresh();
  return { ok: true };
}

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }
  const result = await updateOwnProfile(
    { full_name: parsed.data.fullName, job_title: parsed.data.jobTitle },
    "profile.update_failed",
  );
  return result.ok ? { ok: true, message: "Profile updated" } : result;
}

export async function updatePreferencesAction(input: unknown): Promise<ActionResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose one of the listed options." };
  const result = await updateOwnProfile(
    { date_format: parsed.data.dateFormat, week_starts_on: parsed.data.weekStartsOn },
    "profile.preferences_failed",
  );
  return result.ok ? { ok: true, message: "Preferences saved" } : result;
}

export async function setNotificationPrefAction(input: unknown): Promise<ActionResult> {
  const parsed = notificationPrefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That notification setting doesn’t exist." };
  return updateOwnProfile(
    { [NOTIFICATION_COLUMNS[parsed.data.id]]: parsed.data.enabled },
    "profile.notification_failed",
  );
}
