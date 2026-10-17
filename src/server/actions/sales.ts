"use server";

import { refresh } from "next/cache";

import { FORBIDDEN, context, explain, findOrCreateCompany, invalid } from "@/server/action-helpers";
import type { ActionResult } from "@/server/types";
import {
  archiveSchema,
  convertLeadSchema,
  dealSchema,
  fieldErrorsOf,
  dealStageChangeSchema,
  idSchema,
  leadFormSchema,
  leadSchema,
  stageOrderSchema,
  stageSchema,
} from "@/server/validation";

/**
 * Server actions for leads, deals, pipeline stages and lead forms. They follow
 * the same steps as the Phase 2 actions in `records.ts`: parse, check the
 * session and role, then write as the signed-in user so row-level security
 * applies. The database enforces every rule again.
 */

type Saved = { id: string; name: string };
type Result<T = Saved> = ActionResult<T>;

const archivedAt = (archived: boolean) => (archived ? new Date().toISOString() : null);

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function saveLeadAction(input: unknown, id?: string): Promise<Result> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (id !== undefined && !idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;

  const values = {
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    company_name: parsed.data.companyName,
    source: parsed.data.source,
    status: parsed.data.status,
    notes: parsed.data.notes,
    owner_id: parsed.data.ownerId,
  };
  const query = id
    ? ctx.supabase
        .from("leads")
        .update(values)
        .eq("id", id)
        .eq("workspace_id", ctx.workspace.id)
        .neq("status", "converted")
    : ctx.supabase.from("leads").insert({ ...values, workspace_id: ctx.workspace.id });
  const { data, error } = await query.select("id, name");
  if (error) return explain(error, "lead.save_failed");
  if (!data?.length) return { ok: false, error: "This lead was converted and can’t be edited." };
  refresh();
  return { ok: true, data: data[0] };
}

export async function setLeadArchivedAction(input: unknown): Promise<Result<undefined>> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return FORBIDDEN;
  const ctx = await context("records.archive");
  if (!ctx.allowed) return ctx.failure;

  const { data, error } = await ctx.supabase
    .from("leads")
    .update({ archived_at: archivedAt(parsed.data.archived) })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error || !data?.length) return explain(error, "lead.archive_failed");
  refresh();
  return { ok: true };
}

/**
 * Deletes a lead for good (managers and above). The database refuses when a
 * deal was made from it, and records the deletion in the feed.
 */
export async function deleteLeadAction(id: unknown): Promise<Result<undefined>> {
  if (!idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("records.archive");
  if (!ctx.allowed) return ctx.failure;
  const { error } = await ctx.supabase.rpc("delete_lead", { target_lead: id });
  if (error) {
    if (error.message.includes("not_found")) {
      return { ok: false, error: "This lead was already deleted." };
    }
    return explain(error, "lead.delete_failed");
  }
  refresh();
  return { ok: true };
}

/**
 * Converts a lead in one database transaction. The contact the user picked is
 * used as is; otherwise one with the lead's email is reused, so converting
 * never creates a duplicate person.
 */
export async function convertLeadAction(
  input: unknown,
): Promise<Result<{ contactId: string; dealId: string | null; reusedContact: boolean }>> {
  const parsed = convertLeadSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;

  const { data, error } = await ctx.supabase.rpc("convert_lead", {
    target_lead: parsed.data.leadId,
    existing_contact: parsed.data.contactId,
    create_deal: parsed.data.createDeal,
    deal_name: parsed.data.dealName,
    deal_amount_minor: parsed.data.valueMinor,
    deal_stage: parsed.data.stageId,
    deal_close_on: parsed.data.expectedCloseOn,
  });
  if (error) return explain(error, "lead.convert_failed");
  refresh();
  return {
    ok: true,
    data: data as { contactId: string; dealId: string | null; reusedContact: boolean },
  };
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

export async function saveDealAction(input: unknown, id?: string): Promise<Result> {
  const parsed = dealSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (id !== undefined && !idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;

  let companyId: string | null = null;
  if (parsed.data.companyName) {
    const company = await findOrCreateCompany(ctx, parsed.data.companyName, "prospect");
    if ("error" in company) return explain(company.error, "deal.company_create_failed");
    companyId = company.id;
  }

  const values = {
    name: parsed.data.name,
    company_id: companyId,
    contact_id: parsed.data.contactId,
    owner_id: parsed.data.ownerId,
    stage_id: parsed.data.stageId,
    amount_minor: parsed.data.valueMinor,
    expected_close_on: parsed.data.expectedCloseOn,
    lost_reason: parsed.data.lostReason,
  };
  const query = id
    ? ctx.supabase.from("deals").update(values).eq("id", id).eq("workspace_id", ctx.workspace.id)
    : ctx.supabase.from("deals").insert({ ...values, workspace_id: ctx.workspace.id });
  const { data, error } = await query.select("id, name");
  if (error || !data?.length) return explain(error, "deal.save_failed");
  refresh();
  return { ok: true, data: data[0] };
}

/** Moves a deal to another stage. A lost stage needs a reason. */
export async function moveDealAction(input: unknown): Promise<Result<undefined>> {
  const parsed = dealStageChangeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;

  const { data, error } = await ctx.supabase
    .from("deals")
    .update({ stage_id: parsed.data.stageId, lost_reason: parsed.data.lostReason })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error || !data?.length) return explain(error, "deal.move_failed");
  refresh();
  return { ok: true };
}

export async function setDealArchivedAction(input: unknown): Promise<Result<undefined>> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return FORBIDDEN;
  const ctx = await context("records.archive");
  if (!ctx.allowed) return ctx.failure;

  const { data, error } = await ctx.supabase
    .from("deals")
    .update({ archived_at: archivedAt(parsed.data.archived) })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error || !data?.length) return explain(error, "deal.archive_failed");
  refresh();
  return { ok: true };
}

export type DealHistoryEntry = { id: string; actor: string; action: string; at: string };

/** Every recorded change to one deal, oldest first. */
export async function getDealHistoryAction(dealId: unknown): Promise<Result<DealHistoryEntry[]>> {
  if (!idSchema.safeParse(dealId).success) return FORBIDDEN;
  const ctx = await context("records.view");
  if (!ctx.allowed) return ctx.failure;

  const { data, error } = await ctx.supabase
    .from("activities")
    .select("id, actor_id, summary, created_at")
    .eq("workspace_id", ctx.workspace.id)
    .eq("deal_id", dealId as string)
    .order("created_at")
    .limit(200);
  if (error) return explain(error, "deal.history_failed");

  const actorIds = [...new Set((data ?? []).map((row) => row.actor_id).filter(Boolean))];
  const { data: people } = actorIds.length
    ? await ctx.supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const names = new Map((people ?? []).map((row) => [row.id, row.full_name as string]));
  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: row.id,
      actor: names.get(row.actor_id) ?? "Someone",
      action: row.summary,
      at: row.created_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// Pipeline stages (managers and above)
// ---------------------------------------------------------------------------

export async function addStageAction(input: unknown): Promise<Result> {
  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await context("pipeline.manage");
  if (!ctx.allowed) return ctx.failure;

  // New stages go after the last open stage, before won and lost.
  const { data: stages } = await ctx.supabase
    .from("pipeline_stages")
    .select("id, kind, position")
    .eq("workspace_id", ctx.workspace.id)
    .is("archived_at", null)
    .order("position");
  const live = stages ?? [];
  const lastOpen = live.filter((stage) => stage.kind === "open").at(-1);
  const position = lastOpen ? lastOpen.position + 1 : 0;

  const { data, error } = await ctx.supabase
    .from("pipeline_stages")
    .insert({ workspace_id: ctx.workspace.id, name: parsed.data.name, position, kind: "open" })
    .select("id, name");
  if (error || !data?.length) {
    return explain(error, "stage.add_failed", {
      ok: false,
      error: "A stage with this name already exists.",
      fieldErrors: { name: "A stage with this name already exists." },
    });
  }
  // Keep positions contiguous so later moves are simple.
  const order = [
    ...live.filter((stage) => stage.position < position).map((stage) => stage.id),
    data[0].id,
    ...live.filter((stage) => stage.position >= position).map((stage) => stage.id),
  ];
  await ctx.supabase.rpc("set_stage_order", {
    target_workspace: ctx.workspace.id,
    stage_ids: order,
  });
  refresh();
  return { ok: true, data: data[0] };
}

export async function renameStageAction(id: unknown, input: unknown): Promise<Result> {
  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("pipeline.manage");
  if (!ctx.allowed) return ctx.failure;

  const { data, error } = await ctx.supabase
    .from("pipeline_stages")
    .update({ name: parsed.data.name })
    .eq("id", id as string)
    .eq("workspace_id", ctx.workspace.id)
    .select("id, name");
  if (error || !data?.length) {
    return explain(error, "stage.rename_failed", {
      ok: false,
      error: "A stage with this name already exists.",
      fieldErrors: { name: "A stage with this name already exists." },
    });
  }
  refresh();
  return { ok: true, data: data[0] };
}

export async function setStageArchivedAction(input: unknown): Promise<Result<undefined>> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return FORBIDDEN;
  const ctx = await context("pipeline.manage");
  if (!ctx.allowed) return ctx.failure;

  const { data, error } = await ctx.supabase
    .from("pipeline_stages")
    .update({ archived_at: archivedAt(parsed.data.archived) })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error || !data?.length) {
    return explain(error, "stage.archive_failed", {
      ok: false,
      error: "A live stage already has this name. Rename one of them first.",
    });
  }
  refresh();
  return { ok: true };
}

export async function reorderStagesAction(input: unknown): Promise<Result<undefined>> {
  const parsed = stageOrderSchema.safeParse(input);
  if (!parsed.success) return FORBIDDEN;
  const ctx = await context("pipeline.manage");
  if (!ctx.allowed) return ctx.failure;

  const { error } = await ctx.supabase.rpc("set_stage_order", {
    target_workspace: ctx.workspace.id,
    stage_ids: parsed.data,
  });
  if (error) return explain(error, "stage.reorder_failed");
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lead forms (managers and above)
// ---------------------------------------------------------------------------

export async function saveLeadFormAction(input: unknown, id?: string): Promise<Result> {
  const parsed = leadFormSchema.safeParse(input);
  if (!parsed.success) {
    // Problems inside one question are reported against that question ("fields.3").
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "fields" && typeof issue.path[1] === "number") {
        fieldErrors[`fields.${issue.path[1]}`] ??= issue.message;
      }
    }
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: {
        ...fieldErrorsOf(parsed.error),
        ...fieldErrors,
      },
    };
  }
  if (id !== undefined && !idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("pipeline.manage");
  if (!ctx.allowed) return ctx.failure;

  const values = {
    name: parsed.data.name,
    intro: parsed.data.intro,
    consent_text: parsed.data.consentText,
    success_message: parsed.data.successMessage,
    active: parsed.data.active,
    fields: parsed.data.fields,
    accent_color: parsed.data.accentColor,
    button_label: parsed.data.buttonLabel,
    redirect_url: parsed.data.redirectUrl,
  };
  const query = id
    ? ctx.supabase
        .from("lead_forms")
        .update(values)
        .eq("id", id)
        .eq("workspace_id", ctx.workspace.id)
    : ctx.supabase.from("lead_forms").insert({ ...values, workspace_id: ctx.workspace.id });
  const { data, error } = await query.select("id, name");
  if (error || !data?.length) return explain(error, "lead_form.save_failed");
  refresh();
  return { ok: true, data: data[0] };
}
