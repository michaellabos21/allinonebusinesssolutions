import "server-only";

import type { z } from "zod";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { type Action, can } from "@/server/permissions";
import { getSession } from "@/server/session";
import type { ActionResult } from "@/server/types";
import { fieldErrorsOf } from "@/server/validation";

/**
 * Steps shared by the server actions for business records. A `"use server"`
 * file may only export actions, so these live here.
 */

export const SESSION_ENDED: ActionResult<never> = {
  ok: false,
  error: "Your session has ended. Sign in again.",
};
export const FORBIDDEN: ActionResult<never> = {
  ok: false,
  error: "You don’t have permission to do that.",
};
export const invalid = (error: z.ZodError): ActionResult<never> => ({
  ok: false,
  error: "Check the highlighted fields.",
  fieldErrors: fieldErrorsOf(error),
});

/** The verified workspace and user for an action, or the reason there is none. */
export async function context(action: Action) {
  const session = await getSession();
  if (!session?.workspace) return { allowed: false as const, failure: SESSION_ENDED };
  if (!can(session.workspace.role, action)) return { allowed: false as const, failure: FORBIDDEN };
  return {
    allowed: true as const,
    workspace: session.workspace,
    user: session.user,
    supabase: await createClient(),
  };
}
export type ActionContext = Extract<Awaited<ReturnType<typeof context>>, { allowed: true }>;

type DatabaseError = { code?: string; message: string } | null;

/**
 * Rules the database enforces with a named exception, and what to tell the
 * person. Field names point the message at the right input.
 */
const DATABASE_RULES: Record<string, { error: string; field?: string }> = {
  assignee_not_a_member: { error: "Choose someone on the team.", field: "assigneeIds" },
  too_many_assignees: { error: "Assign up to 10 people.", field: "assigneeIds" },
  task_not_editable: { error: "You can only change tasks you created or are assigned." },
  comment_deleted: { error: "That comment was deleted." },
  owner_not_a_member: { error: "Choose someone on the team.", field: "ownerId" },
  lost_reason_required: { error: "Say why the deal was lost.", field: "lostReason" },
  stage_archived: { error: "That stage has been archived. Choose another.", field: "stageId" },
  stage_has_deals: {
    error: "Move this stage’s deals to another stage before archiving it.",
  },
  pipeline_needs_open_won_lost: {
    error: "The pipeline needs at least one open stage, one won stage and one lost stage.",
  },
  stage_kind_in_use: { error: "Deals have used this stage, so its type can’t change." },
  invalid_stage_list: { error: "The stage list changed. Reload the page and try again." },
  already_converted: { error: "This has already been converted. Reload to see the result." },
  lead_archived: { error: "Restore this lead before converting it." },
  email_required: {
    error: "Add the lead’s email, or choose an existing contact, to convert it.",
    field: "email",
  },
  contact_not_found: {
    error: "That contact no longer exists. Choose another.",
    field: "contactId",
  },
  // Finance
  invalid_items: { error: "Check the lines: each needs a description, quantity and price." },
  lead_has_deal: {
    error: "This lead became a deal, so it’s kept as part of that deal’s history.",
  },
  not_a_draft: { error: "Only drafts can be changed. This one has already been issued." },
  bill_to_required: {
    error: "Choose who the document is for before issuing it.",
    field: "contactId",
  },
  total_required: { error: "The total must be above zero to issue." },
  not_payable: { error: "Payments can only be recorded on issued, unpaid invoices." },
  overpayment: {
    error: "That is more than is still owed. Record the amount actually outstanding.",
    field: "amountMinor",
  },
  invalid_amount: { error: "Enter an amount above zero.", field: "amountMinor" },
  invalid_date: { error: "The payment date can’t be in the future.", field: "paidOn" },
  not_issued: { error: "Drafts aren’t voided; delete the draft instead." },
  has_payments: {
    error:
      "This invoice has payments recorded, so it can’t be voided. Refunds aren’t supported yet.",
  },
  reason_required: { error: "Say why the invoice is being voided.", field: "reason" },
  not_sent: { error: "Send the estimate before recording the client’s answer." },
  not_accepted: { error: "Only an accepted estimate can become an invoice." },
};

/** Turns a database refusal into something a person can act on. */
export function explain(
  error: DatabaseError,
  event: string,
  duplicate?: ActionResult<never>,
): ActionResult<never> {
  if (error?.code === "23505" && duplicate) return duplicate;
  if (error?.code === "42501") return FORBIDDEN;
  const rule = Object.entries(DATABASE_RULES).find(([name]) => error?.message.includes(name));
  if (rule) {
    const [, { error: message, field }] = rule;
    return { ok: false, error: message, fieldErrors: field ? { [field]: message } : undefined };
  }
  const code = error?.code ?? "no_rows";
  logger.error(event, { code, message: error?.message ?? "no rows changed" });
  if (SCHEMA_MISSING.has(code)) {
    return {
      ok: false,
      error: `The database is missing part of the latest update (code ${code}). Run the newest SQL file from supabase/migrations in the Supabase SQL Editor.`,
    };
  }
  // The code is safe to show and lets a person report exactly what failed.
  return { ok: false, error: `We couldn’t save that. Try again. (Code ${code})` };
}

/**
 * Errors meaning a table, column or function the app expects isn't in the
 * database: Postgres 42P01 (table), 42703 (column), 42883 (function), and
 * PostgREST's schema-cache equivalents.
 */
const SCHEMA_MISSING = new Set(["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"]);

/**
 * Finds a company by name in the workspace, or creates it. A unique index on
 * the lower-cased name makes this safe if two people add the same company at once.
 */
export async function findOrCreateCompany(
  ctx: ActionContext,
  name: string,
  type: "client" | "prospect",
): Promise<{ id: string } | { error: DatabaseError }> {
  const existing = await ctx.supabase
    .from("companies")
    .select("id")
    .eq("workspace_id", ctx.workspace.id)
    .ilike("name", name.replace(/[%_\\]/g, "\\$&"))
    .maybeSingle();
  if (existing.data) return { id: existing.data.id };
  const created = await ctx.supabase
    .from("companies")
    .insert({ workspace_id: ctx.workspace.id, name, type })
    .select("id")
    .single();
  if (created.error) return { error: created.error };
  return { id: created.data.id };
}
