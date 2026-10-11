"use server";

import { refresh } from "next/cache";
import type { z } from "zod";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { type Action, can } from "@/server/permissions";
import { getSession } from "@/server/session";
import type { ActionResult } from "@/server/types";
import {
  IMPORT_ROW_LIMIT,
  archiveSchema,
  catalogItemSchema,
  companySchema,
  contactSchema,
  fieldErrorsOf,
  idSchema,
  importRowSchema,
  noteSchema,
  projectSchema,
  taskSchema,
  taskStatusSchema,
} from "@/server/validation";

/**
 * Server actions for business records. Every one follows the same steps:
 * parse the input, load the session, check the role, then write as the
 * signed-in user so row-level security applies. The workspace id always comes
 * from the session. The database repeats each rule, so a mistake here cannot
 * open a hole; this layer exists to give clear errors.
 */

type Saved = { id: string; name: string };
type Result<T = Saved> = ActionResult<T>;

const SESSION_ENDED: ActionResult<never> = {
  ok: false,
  error: "Your session has ended. Sign in again.",
};
const FORBIDDEN: ActionResult<never> = {
  ok: false,
  error: "You don’t have permission to do that.",
};
const invalid = (error: z.ZodError): ActionResult<never> => ({
  ok: false,
  error: "Check the highlighted fields.",
  fieldErrors: fieldErrorsOf(error),
});

/** The verified workspace and user for an action, or the reason there is none. */
async function context(action: Action) {
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

type DatabaseError = { code?: string; message: string } | null;

/** Turns a database refusal into something a person can act on. */
function explain(
  error: DatabaseError,
  event: string,
  duplicate?: ActionResult<never>,
): ActionResult<never> {
  if (error?.code === "23505" && duplicate) return duplicate;
  if (error?.code === "42501") return FORBIDDEN;
  if (error?.message.includes("assignee_not_a_member")) {
    return {
      ok: false,
      error: "Choose someone on the team.",
      fieldErrors: { assigneeId: "This person isn’t a team member." },
    };
  }
  if (error?.message.includes("owner_not_a_member")) {
    return {
      ok: false,
      error: "Choose someone on the team.",
      fieldErrors: { ownerId: "This person isn’t a team member." },
    };
  }
  logger.error(event, {
    code: error?.code ?? "no_rows",
    message: error?.message ?? "no rows changed",
  });
  return { ok: false, error: "We couldn’t save that. Try again." };
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export async function saveCompanyAction(input: unknown, id?: string): Promise<Result> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (id !== undefined && !idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;

  const query = id
    ? ctx.supabase
        .from("companies")
        .update(parsed.data)
        .eq("id", id)
        .eq("workspace_id", ctx.workspace.id)
    : ctx.supabase.from("companies").insert({ ...parsed.data, workspace_id: ctx.workspace.id });
  const { data, error } = await query.select("id, name");
  if (error || !data?.length) {
    return explain(error, "company.save_failed", {
      ok: false,
      error: "A company with this name already exists.",
      fieldErrors: { name: "A company with this name already exists. It may be archived." },
    });
  }
  refresh();
  return { ok: true, data: data[0] };
}

export async function setCompanyArchivedAction(input: unknown): Promise<Result<undefined>> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return FORBIDDEN;
  const ctx = await context("records.archive");
  if (!ctx.allowed) return ctx.failure;

  const { data, error } = await ctx.supabase
    .from("companies")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error || !data?.length) return explain(error, "company.archive_failed");
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function saveContactAction(input: unknown, id?: string): Promise<Result> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (id !== undefined && !idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;

  const { companyName, ...fields } = parsed.data;

  // Find the company by name, or create it. A unique index on the lower-cased
  // name makes this safe if two people add the same company at once.
  let companyId: string | null = null;
  if (companyName) {
    const existing = await ctx.supabase
      .from("companies")
      .select("id")
      .eq("workspace_id", ctx.workspace.id)
      .ilike("name", companyName.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle();
    if (existing.data) {
      companyId = existing.data.id;
    } else {
      const created = await ctx.supabase
        .from("companies")
        .insert({
          workspace_id: ctx.workspace.id,
          name: companyName,
          type: fields.status === "lead" ? "prospect" : "client",
        })
        .select("id")
        .single();
      if (created.error) return explain(created.error, "contact.company_create_failed");
      companyId = created.data.id;
    }
  }

  const values = { ...fields, company_id: companyId };
  const query = id
    ? ctx.supabase.from("contacts").update(values).eq("id", id).eq("workspace_id", ctx.workspace.id)
    : ctx.supabase.from("contacts").insert({ ...values, workspace_id: ctx.workspace.id });
  const { data, error } = await query.select("id, name");
  if (error || !data?.length) {
    return explain(error, "contact.save_failed", {
      ok: false,
      error: "A contact with this email already exists.",
      fieldErrors: { email: "Another contact already uses this email. They may be archived." },
    });
  }
  refresh();
  return { ok: true, data: data[0] };
}

export async function setContactArchivedAction(input: unknown): Promise<Result<undefined>> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return FORBIDDEN;
  const ctx = await context("records.archive");
  if (!ctx.allowed) return ctx.failure;

  const { data, error } = await ctx.supabase
    .from("contacts")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error || !data?.length) return explain(error, "contact.archive_failed");
  refresh();
  return { ok: true };
}

export async function addNoteAction(input: unknown): Promise<Result<undefined>> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;

  const { error } = await ctx.supabase.from("contact_notes").insert({
    workspace_id: ctx.workspace.id,
    contact_id: parsed.data.contactId,
    body: parsed.data.body,
  });
  if (error) return explain(error, "note.add_failed");
  refresh();
  return { ok: true };
}

/**
 * Imports contacts from a mapped CSV. Every row is validated again here; the
 * browser's preview is a convenience, not a gate. The database function then
 * writes all rows in one transaction and reports the emails it skipped.
 */
export async function importContactsAction(
  input: unknown,
): Promise<Result<{ imported: number; skipped: { row: number; reason: string }[] }>> {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: "There are no rows to import." };
  }
  if (input.length > IMPORT_ROW_LIMIT) {
    return { ok: false, error: `Import up to ${IMPORT_ROW_LIMIT} contacts at a time.` };
  }
  const rows = input.map((row) => importRowSchema.safeParse(row));
  const firstBad = rows.findIndex((row) => !row.success);
  if (firstBad !== -1) {
    return {
      ok: false,
      error: `Row ${firstBad + 1} is not valid. Fix it in the file and upload again.`,
    };
  }
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;

  const { data, error } = await ctx.supabase.rpc("import_contacts", {
    target_workspace: ctx.workspace.id,
    rows: rows.map((row) => row.data),
  });
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "Two rows in the file share an email address. Remove the duplicate and upload again.",
      };
    }
    return explain(error, "contact.import_failed");
  }
  refresh();
  return {
    ok: true,
    data: data as { imported: number; skipped: { row: number; reason: string }[] },
  };
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export async function saveCatalogItemAction(input: unknown, id?: string): Promise<Result> {
  const parsed = catalogItemSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (id !== undefined && !idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("catalog.manage");
  if (!ctx.allowed) return ctx.failure;

  const values = {
    name: parsed.data.name,
    description: parsed.data.description,
    type: parsed.data.type,
    unit_price_minor: parsed.data.unitPriceMinor,
    unit: parsed.data.unit.toLowerCase(),
  };
  const query = id
    ? ctx.supabase
        .from("products_services")
        .update(values)
        .eq("id", id)
        .eq("workspace_id", ctx.workspace.id)
    : ctx.supabase
        .from("products_services")
        // The price is in the workspace's currency at the time it is saved.
        .insert({ ...values, workspace_id: ctx.workspace.id, currency: ctx.workspace.currency });
  const { data, error } = await query.select("id, name");
  if (error || !data?.length) {
    return explain(error, "catalog.save_failed", {
      ok: false,
      error: "An item with this name already exists.",
      fieldErrors: { name: "An item with this name already exists. It may be archived." },
    });
  }
  refresh();
  return { ok: true, data: data[0] };
}

export async function setCatalogItemArchivedAction(input: unknown): Promise<Result<undefined>> {
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return FORBIDDEN;
  const ctx = await context("catalog.manage");
  if (!ctx.allowed) return ctx.failure;

  const { data, error } = await ctx.supabase
    .from("products_services")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error || !data?.length) return explain(error, "catalog.archive_failed");
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Projects and tasks
// ---------------------------------------------------------------------------

export async function saveProjectAction(input: unknown, id?: string): Promise<Result> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (id !== undefined && !idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("projects.manage");
  if (!ctx.allowed) return ctx.failure;

  const values = {
    name: parsed.data.name,
    description: parsed.data.description,
    contact_id: parsed.data.contactId,
    owner_id: parsed.data.ownerId,
    status: parsed.data.status,
    due_on: parsed.data.dueOn,
  };
  const query = id
    ? ctx.supabase.from("projects").update(values).eq("id", id).eq("workspace_id", ctx.workspace.id)
    : ctx.supabase.from("projects").insert({ ...values, workspace_id: ctx.workspace.id });
  const { data, error } = await query.select("id, name");
  if (error || !data?.length) return explain(error, "project.save_failed");
  refresh();
  return { ok: true, data: data[0] };
}

export async function saveTaskAction(input: unknown, id?: string): Promise<Result> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (id !== undefined && !idSchema.safeParse(id).success) return FORBIDDEN;
  const ctx = await context("records.edit");
  if (!ctx.allowed) return ctx.failure;

  const values = {
    title: parsed.data.title,
    description: parsed.data.description,
    project_id: parsed.data.projectId,
    assignee_id: parsed.data.assigneeId,
    status: parsed.data.status,
    priority: parsed.data.priority,
    due_on: parsed.data.dueOn,
  };
  // Whether a member may edit this particular task is decided by row-level
  // security: an update they are not allowed simply changes no rows.
  const query = id
    ? ctx.supabase.from("tasks").update(values).eq("id", id).eq("workspace_id", ctx.workspace.id)
    : ctx.supabase.from("tasks").insert({ ...values, workspace_id: ctx.workspace.id });
  const { data, error } = await query.select("id, title");
  if (error) return explain(error, "task.save_failed");
  if (!data?.length) {
    return { ok: false, error: "You can only edit tasks you created or are assigned." };
  }
  refresh();
  return { ok: true, data: { id: data[0].id, name: data[0].title } };
}

export async function setTaskStatusAction(input: unknown): Promise<Result<undefined>> {
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
  if (!data?.length) {
    return { ok: false, error: "You can only change tasks you created or are assigned." };
  }
  refresh();
  return { ok: true };
}
