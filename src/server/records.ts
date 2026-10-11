import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  ActivityEntry,
  CatalogItem,
  Company,
  Contact,
  Deal,
  DealStage,
  Lead,
  LeadForm,
  Note,
  Project,
  Task,
} from "@/mocks/types";
import { type Role, can } from "@/server/permissions";

/** The real business records of one workspace, in the shapes the screens use. */
export type WorkspaceRecords = {
  companies: Company[];
  contacts: Contact[];
  notes: Note[];
  catalog: CatalogItem[];
  projects: Project[];
  tasks: Task[];
  activity: ActivityEntry[];
  /** Live and archived stages, in pipeline order. */
  stages: DealStage[];
  deals: Deal[];
  leads: Lead[];
  /** Only loaded for managers and above, who are the ones who can share or change them. */
  leadForms: LeadForm[];
  /** True if any list hit its row cap, so the screens can say the view is partial. */
  truncated: boolean;
};

/**
 * Rows loaded per table. The screens search, filter, sort and page in the
 * browser, which is right for a small business's data and wrong beyond it.
 * Past this cap a table needs server-side paging; `truncated` flags the case.
 */
const ROW_CAP = 2000;
const ACTIVITY_CAP = 100;

const EMPTY: WorkspaceRecords = {
  companies: [],
  contacts: [],
  notes: [],
  catalog: [],
  projects: [],
  tasks: [],
  activity: [],
  stages: [],
  deals: [],
  leads: [],
  leadForms: [],
  truncated: false,
};

const day = (timestamp: string) => timestamp.slice(0, 10);

/**
 * Loads a workspace's records as the signed-in user. Row-level security does
 * the real filtering: a query for a workspace the user cannot use returns
 * nothing. The role check here only saves the round trips.
 */
export async function getWorkspaceRecords(
  workspaceId: string,
  role: Role,
): Promise<WorkspaceRecords> {
  if (!can(role, "records.view")) return EMPTY;
  const supabase = await createClient();
  const scoped = (table: string, columns: string) =>
    supabase.from(table).select(columns).eq("workspace_id", workspaceId).limit(ROW_CAP);

  const [
    companies,
    contacts,
    notes,
    catalog,
    projects,
    tasks,
    activity,
    stages,
    deals,
    leads,
    leadForms,
  ] = await Promise.all([
    scoped(
      "companies",
      "id, name, type, industry, city, website, phone, address, notes, archived_at, created_at",
    ).order("name"),
    scoped(
      "contacts",
      "id, company_id, name, email, phone, title, status, tags, archived_at, created_at",
    ).order("name"),
    scoped("contact_notes", "id, contact_id, author_id, body, created_at").order("created_at", {
      ascending: false,
    }),
    scoped(
      "products_services",
      "id, name, description, type, unit_price_minor, unit, archived_at",
    ).order("name"),
    scoped(
      "projects",
      "id, name, description, contact_id, owner_id, status, start_on, due_on",
    ).order("due_on"),
    scoped(
      "tasks",
      "id, project_id, title, description, status, priority, due_on, assignee_id, created_by",
    ).order("due_on"),
    supabase
      .from("activities")
      .select("id, actor_id, kind, summary, href, project_id, deal_id, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(ACTIVITY_CAP),
    scoped("pipeline_stages", "id, name, position, kind, archived_at").order("position"),
    scoped(
      "deals",
      "id, name, company_id, contact_id, owner_id, stage_id, amount_minor, currency, expected_close_on, closed_on, lost_reason, lead_id, archived_at",
    ).order("expected_close_on"),
    scoped(
      "leads",
      "id, name, email, phone, company_name, source, status, notes, owner_id, form_id, converted_contact_id, converted_deal_id, archived_at, created_at",
    ).order("created_at", { ascending: false }),
    can(role, "pipeline.manage")
      ? scoped(
          "lead_forms",
          "id, name, token, intro, consent_text, success_message, active, created_at",
        ).order("created_at")
      : Promise.resolve({ data: [] }),
  ]);

  // Names for the feed. Row-level security limits this to people the user shares a workspace with.
  const actorIds = [
    ...new Set((activity.data ?? []).map((row) => row.actor_id).filter(Boolean)),
  ] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const actorName = new Map((actors ?? []).map((row) => [row.id, row.full_name]));

  // Results are untyped until database types are generated (see supabase/README.md).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Row = Record<string, any>;
  const rows = (result: { data: unknown }) => (result.data ?? []) as Row[];

  const stageKind = new Map(rows(stages).map((row) => [row.id, row.kind as Deal["stageKind"]]));

  return {
    companies: rows(companies).map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as Company["type"],
      industry: row.industry,
      city: row.city,
      website: row.website,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      createdOn: day(row.created_at),
      archived: row.archived_at !== null,
    })),
    contacts: rows(contacts).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      title: row.title,
      status: row.status as Contact["status"],
      tags: row.tags,
      createdOn: day(row.created_at),
      archived: row.archived_at !== null,
    })),
    notes: rows(notes).map((row) => ({
      id: row.id,
      contactId: row.contact_id,
      authorId: row.author_id ?? "",
      body: row.body,
      at: row.created_at,
    })),
    catalog: rows(catalog).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type as CatalogItem["type"],
      unitPriceMinor: Number(row.unit_price_minor),
      unit: row.unit,
      archived: row.archived_at !== null,
    })),
    projects: rows(projects).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      contactId: row.contact_id,
      ownerId: row.owner_id,
      status: row.status as Project["status"],
      startOn: row.start_on,
      dueOn: row.due_on,
    })),
    tasks: rows(tasks).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      status: row.status as Task["status"],
      priority: row.priority as Task["priority"],
      dueOn: row.due_on,
      assigneeId: row.assignee_id,
      createdBy: row.created_by,
    })),
    activity: rows(activity).map((row) => ({
      id: row.id,
      kind: row.kind as ActivityEntry["kind"],
      // Public form submissions are the only entries written without a person.
      actor:
        actorName.get(row.actor_id) ??
        (row.actor_id === null && row.kind === "lead" ? "A website visitor" : "Someone"),
      action: row.summary,
      at: row.created_at,
      href: row.href,
      projectId: row.project_id ?? undefined,
      dealId: row.deal_id ?? undefined,
    })),
    stages: rows(stages).map((row) => ({
      id: row.id,
      name: row.name,
      position: row.position,
      kind: row.kind as DealStage["kind"],
      archived: row.archived_at !== null,
    })),
    deals: rows(deals).map((row) => ({
      id: row.id,
      name: row.name,
      companyId: row.company_id,
      contactId: row.contact_id,
      ownerId: row.owner_id,
      stageId: row.stage_id,
      stageKind: stageKind.get(row.stage_id) ?? "open",
      valueMinor: Number(row.amount_minor),
      currency: row.currency,
      expectedCloseOn: row.expected_close_on,
      closedOn: row.closed_on,
      lostReason: row.lost_reason,
      leadId: row.lead_id,
      archived: row.archived_at !== null,
    })),
    leads: rows(leads).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      companyName: row.company_name,
      source: row.source,
      status: row.status as Lead["status"],
      notes: row.notes,
      ownerId: row.owner_id,
      formId: row.form_id,
      convertedContactId: row.converted_contact_id,
      convertedDealId: row.converted_deal_id,
      createdOn: day(row.created_at),
      archived: row.archived_at !== null,
    })),
    leadForms: rows(leadForms).map((row) => ({
      id: row.id,
      name: row.name,
      token: row.token,
      intro: row.intro,
      consentText: row.consent_text,
      successMessage: row.success_message,
      active: row.active,
      createdOn: day(row.created_at),
    })),
    truncated: [companies, contacts, notes, catalog, projects, tasks, deals, leads].some(
      (result) => (result.data?.length ?? 0) >= ROW_CAP,
    ),
  };
}
