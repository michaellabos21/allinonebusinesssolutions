"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/server/permissions";
import { ACTIVE_WORKSPACE_COOKIE, getSession } from "@/server/session";
import type { ActionResult, NavigateResult } from "@/server/types";
import {
  createWorkspaceSchema,
  fieldErrorsOf,
  idSchema,
  workspaceSettingsSchema,
} from "@/server/validation";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const;

export async function createWorkspaceAction(
  _previous: NavigateResult | null,
  formData: FormData,
): Promise<NavigateResult> {
  const parsed = createWorkspaceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      values: { name: String(formData.get("name") ?? "") },
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }
  const session = await getSession();
  if (!session) return { ok: true, data: { redirectTo: "/login" } };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workspace", {
    workspace_name: parsed.data.name,
    workspace_timezone: parsed.data.timezone,
    workspace_country: parsed.data.country,
    workspace_currency: parsed.data.currency,
  });
  if (error || !data) {
    logger.error("workspace.create_failed", { code: error?.code ?? "unknown" });
    return {
      ok: false,
      values: { name: String(formData.get("name") ?? "") },
      error: "We couldn’t create the workspace. Try again in a moment.",
    };
  }
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, data as string, COOKIE_OPTIONS);
  return { ok: true, data: { redirectTo: "/" } };
}

/** Remembers which workspace to open. Only the user's own workspaces are accepted. */
export async function switchWorkspaceAction(workspaceId: string): Promise<NavigateResult> {
  const parsed = idSchema.safeParse(workspaceId);
  const session = await getSession();
  if (!session) return { ok: false, error: "Your session has ended. Sign in again." };
  const target = parsed.success
    ? session.workspaces.find((item) => item.id === parsed.data)
    : undefined;
  if (!target) return { ok: false, error: "You don’t have access to that workspace." };

  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, target.id, COOKIE_OPTIONS);
  return { ok: true, data: { redirectTo: "/" } };
}

export async function updateWorkspaceSettingsAction(input: unknown): Promise<ActionResult> {
  const parsed = workspaceSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }
  const session = await getSession();
  if (!session?.workspace) return { ok: false, error: "Your session has ended. Sign in again." };
  if (!can(session.workspace.role, "workspace.update_settings")) {
    return { ok: false, error: "Only an owner or admin can change workspace settings." };
  }

  const supabase = await createClient();
  // The workspace id comes from the verified session, never from the form.
  const { data, error } = await supabase
    .from("workspaces")
    .update({
      name: parsed.data.name,
      currency: parsed.data.currency,
      tax_rate_bps: parsed.data.taxRateBps,
      payment_term_days: parsed.data.paymentTermDays,
      invoice_prefix: parsed.data.invoicePrefix,
      estimate_prefix: parsed.data.estimatePrefix,
    })
    .eq("id", session.workspace.id)
    .select("id");
  if (error || !data?.length) {
    logger.error("workspace.update_failed", { code: error?.code ?? "no_rows" });
    return { ok: false, error: "We couldn’t save the workspace settings. Try again." };
  }
  refresh();
  return { ok: true, message: "Workspace settings saved" };
}
