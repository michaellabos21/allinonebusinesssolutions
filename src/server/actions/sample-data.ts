"use server";

import { refresh } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import {
  DEAL_STAGES,
  catalogItems,
  companies,
  contacts,
  deals,
  notes,
  projects,
  tasks,
} from "@/mocks";
import { can } from "@/server/permissions";
import { getSession } from "@/server/session";
import type { ActionResult } from "@/server/types";

/**
 * Fills an empty workspace with the fictional records from `src/mocks`, as
 * ordinary saved records owned by the person who asked.
 *
 * A development and demo aid, off unless `ENABLE_SAMPLE_DATA=true`. It writes
 * through the normal tables as the signed-in user, so validation, row-level
 * security and the activity feed all apply exactly as they do for real input.
 */
/** Fictional enquiries at different points, so the leads screen has something to show. */
const SAMPLE_LEADS = [
  {
    name: "Marco Villanueva",
    email: "marco@villanuevafarms.example",
    company_name: "Villanueva Farms",
    source: "Website",
    status: "new" as const,
    notes: "Wants a simple site to sell produce boxes online.",
    owned: false,
  },
  {
    name: "Tessa Lim",
    email: "tessa@limdental.example",
    company_name: "Lim Dental",
    source: "Referral",
    status: "contacted" as const,
    notes: "Referred by Liza Mercado. Asked about a booking page.",
    owned: true,
  },
  {
    name: "Rafael Ocampo",
    email: "rafael@ocampobuilds.example",
    company_name: "Ocampo Builds",
    source: "Event",
    status: "qualified" as const,
    notes: "Met at the Iloilo business expo. Budget agreed for a rebrand.",
    owned: true,
  },
];

export async function loadSampleRecordsAction(): Promise<ActionResult> {
  if (process.env.ENABLE_SAMPLE_DATA !== "true") {
    return { ok: false, error: "Sample records are not available in this environment." };
  }
  const session = await getSession();
  if (!session?.workspace) return { ok: false, error: "Your session has ended. Sign in again." };
  if (!can(session.workspace.role, "projects.manage")) {
    return { ok: false, error: "A manager or admin can add sample records." };
  }
  const supabase = await createClient();
  const workspace_id = session.workspace.id;
  const me = session.user.id;

  const existing = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace_id);
  if ((existing.count ?? 0) > 0) {
    return {
      ok: false,
      error: "This workspace already has contacts. Sample records are only for an empty one.",
    };
  }

  const fail = (step: string, message: string): ActionResult => {
    logger.error("sample_data.failed", { step, message });
    return {
      ok: false,
      error: "We couldn’t add the sample records. Some may have been added; check the lists.",
    };
  };

  const companyRows = await supabase
    .from("companies")
    .insert(
      companies.map((company) => ({
        workspace_id,
        name: company.name,
        type: company.type,
        industry: company.industry,
        city: company.city,
        website: company.website,
      })),
    )
    .select("id, name");
  if (companyRows.error) return fail("companies", companyRows.error.message);
  const companyId = new Map(
    companies.map((company) => [
      company.id,
      companyRows.data.find((row) => row.name === company.name)?.id,
    ]),
  );

  const contactRows = await supabase
    .from("contacts")
    .insert(
      contacts.map((contact) => ({
        workspace_id,
        company_id: companyId.get(contact.companyId ?? "") ?? null,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        status: contact.status,
        tags: contact.tags,
        source: "Sample data",
      })),
    )
    .select("id, email");
  if (contactRows.error) return fail("contacts", contactRows.error.message);
  const contactId = new Map(
    contacts.map((contact) => [
      contact.id,
      contactRows.data.find((row) => row.email === contact.email)?.id,
    ]),
  );

  const noteRows = await supabase.from("contact_notes").insert(
    notes
      .filter((note) => contactId.get(note.contactId))
      .map((note) => ({
        workspace_id,
        contact_id: contactId.get(note.contactId),
        body: note.body,
      })),
  );
  if (noteRows.error) return fail("notes", noteRows.error.message);

  const catalogRows = await supabase.from("products_services").insert(
    catalogItems.map((item) => ({
      workspace_id,
      name: item.name,
      description: item.description,
      type: item.type,
      unit_price_minor: item.unitPriceMinor,
      currency: session.workspace!.currency,
      unit: item.unit,
    })),
  );
  if (catalogRows.error) return fail("catalog", catalogRows.error.message);

  const projectRows = await supabase
    .from("projects")
    .insert(
      projects.map((project) => ({
        workspace_id,
        name: project.name,
        description: project.description,
        contact_id: contactId.get(project.contactId ?? "") ?? null,
        owner_id: me,
        status: project.status,
        start_on: project.startOn,
        due_on: project.dueOn,
      })),
    )
    .select("id, name");
  if (projectRows.error) return fail("projects", projectRows.error.message);
  const projectId = new Map(
    projects.map((project) => [
      project.id,
      projectRows.data.find((row) => row.name === project.name)?.id,
    ]),
  );

  const taskRows = await supabase
    .from("tasks")
    .insert(
      tasks.map((task) => ({
        workspace_id,
        project_id: projectId.get(task.projectId ?? "") ?? null,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_on: task.dueOn,
      })),
    )
    .select("id");
  if (taskRows.error) return fail("tasks", taskRows.error.message);
  // Sample tasks are all yours, so there is something under "Me".
  const assigned = await supabase
    .from("task_assignees")
    .insert((taskRows.data ?? []).map((row) => ({ task_id: row.id, workspace_id, user_id: me })));
  if (assigned.error) return fail("task assignees", assigned.error.message);

  // Sample deals sit in the workspace's own stages, matched by name.
  const { data: stageRows } = await supabase
    .from("pipeline_stages")
    .select("id, name")
    .eq("workspace_id", workspace_id)
    .is("archived_at", null);
  const stageId = new Map(
    DEAL_STAGES.map((stage) => [stage.id, stageRows?.find((row) => row.name === stage.name)?.id]),
  );
  const dealRows = await supabase.from("deals").insert(
    deals
      .filter((deal) => stageId.get(deal.stageId))
      .map((deal) => ({
        workspace_id,
        name: deal.name,
        company_id: companyId.get(deal.companyId ?? "") ?? null,
        contact_id: contactId.get(deal.contactId ?? "") ?? null,
        owner_id: me,
        stage_id: stageId.get(deal.stageId),
        amount_minor: deal.valueMinor,
        expected_close_on: deal.expectedCloseOn,
        lost_reason: deal.lostReason,
      })),
  );
  if (dealRows.error) return fail("deals", dealRows.error.message);

  const leadRows = await supabase.from("leads").insert(
    SAMPLE_LEADS.map(({ owned, ...lead }) => ({
      ...lead,
      workspace_id,
      owner_id: owned ? me : null,
    })),
  );
  if (leadRows.error) return fail("leads", leadRows.error.message);

  refresh();
  return { ok: true };
}
