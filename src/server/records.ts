import "server-only";

import { splitLineText } from "@/lib/document-lines";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivityEntry,
  CatalogItem,
  Company,
  Contact,
  Deal,
  DealStage,
  Estimate,
  Expense,
  Invoice,
  InvoiceItem,
  Lead,
  LeadForm,
  Note,
  Payment,
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
  /** Finance: loaded only for roles that may see it, otherwise empty. */
  invoices: Invoice[];
  payments: Payment[];
  estimates: Estimate[];
  expenses: Expense[];
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
  invoices: [],
  payments: [],
  estimates: [],
  expenses: [],
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
      "id, company_id, name, email, phone, title, status, tags, photo_path, archived_at, created_at",
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

  const finance = can(role, "finance.manage")
    ? await loadFinance(supabase, workspaceId)
    : { invoices: [], payments: [], estimates: [], expenses: [], truncated: false };

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
      photoPath: row.photo_path,
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
    invoices: finance.invoices,
    payments: finance.payments,
    estimates: finance.estimates,
    expenses: finance.expenses,
    truncated:
      finance.truncated ||
      [companies, contacts, notes, catalog, projects, tasks, deals, leads].some(
        (result) => (result.data?.length ?? 0) >= ROW_CAP,
      ),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinanceRow = Record<string, any>;

const toItem = (row: FinanceRow): InvoiceItem => ({
  id: row.id,
  description: row.description,
  quantityMilli: Number(row.quantity_milli),
  unitPriceMinor: Number(row.unit_price_minor),
  amountMinor: Number(row.amount_minor),
  catalogItemId: row.catalog_item_id,
});

/** Invoices, estimates, payments and expenses, with their lines attached. */
async function loadFinance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
) {
  const scoped = (table: string, columns: string) =>
    supabase.from(table).select(columns).eq("workspace_id", workspaceId).limit(ROW_CAP);
  const [invoices, invoiceItems, payments, estimates, estimateItems, expenses] = await Promise.all([
    scoped(
      "invoices",
      "id, number, contact_id, bill_to, status, currency, issued_on, due_on, discount_minor, tax_rate_bps, notes, subtotal_minor, tax_minor, total_minor, paid_minor, estimate_id, void_reason",
    ).order("issued_on", { ascending: false }),
    supabase
      .from("invoice_items")
      .select(
        "id, invoice_id, position, description, quantity_milli, unit_price_minor, amount_minor, catalog_item_id",
      )
      .eq("workspace_id", workspaceId)
      .order("position")
      .limit(ROW_CAP * 10),
    scoped("payments", "id, invoice_id, amount_minor, paid_on, method, reference, note").order(
      "paid_on",
    ),
    scoped(
      "estimates",
      "id, number, contact_id, status, currency, issued_on, valid_until, discount_minor, tax_rate_bps, notes, subtotal_minor, tax_minor, total_minor, converted_invoice_id",
    ).order("issued_on", { ascending: false }),
    supabase
      .from("estimate_items")
      .select(
        "id, estimate_id, position, description, quantity_milli, unit_price_minor, amount_minor, catalog_item_id",
      )
      .eq("workspace_id", workspaceId)
      .order("position")
      .limit(ROW_CAP * 10),
    scoped(
      "expenses",
      "id, spent_on, vendor, category, description, amount_minor, currency, payment_method, notes, project_id, receipt_path, archived_at",
    ).order("spent_on", { ascending: false }),
  ]);
  const rows = (result: { data: unknown }) => (result.data ?? []) as FinanceRow[];

  const group = (items: FinanceRow[], key: string) => {
    const byParent = new Map<string, InvoiceItem[]>();
    for (const row of items) {
      const list = byParent.get(row[key]) ?? [];
      list.push(toItem(row));
      byParent.set(row[key], list);
    }
    return byParent;
  };
  const linesByInvoice = group(rows(invoiceItems), "invoice_id");
  const linesByEstimate = group(rows(estimateItems), "estimate_id");

  const paymentList: Payment[] = rows(payments).map((row) => ({
    id: row.id,
    invoiceId: row.invoice_id,
    amountMinor: Number(row.amount_minor),
    paidOn: row.paid_on,
    method: row.method,
    reference: row.reference,
    note: row.note,
  }));
  const lastPaymentOn = new Map<string, string>();
  for (const payment of paymentList) lastPaymentOn.set(payment.invoiceId, payment.paidOn);

  return {
    invoices: rows(invoices).map((row): Invoice => {
      const items = linesByInvoice.get(row.id) ?? [];
      const billTo = row.bill_to && row.bill_to.name ? row.bill_to : null;
      return {
        id: row.id,
        number: row.number,
        contactId: row.contact_id,
        billTo,
        // The list shows the first line's name, not its details.
        description: splitLineText(items[0]?.description ?? "").name,
        items,
        discountMinor: Number(row.discount_minor),
        taxRateBps: row.tax_rate_bps,
        notes: row.notes,
        subtotalMinor: Number(row.subtotal_minor),
        taxMinor: Number(row.tax_minor),
        amountMinor: Number(row.total_minor),
        paidMinor: Number(row.paid_minor),
        currency: row.currency,
        status: row.status,
        issuedOn: row.issued_on,
        dueOn: row.due_on,
        paidOn: row.status === "paid" ? (lastPaymentOn.get(row.id) ?? null) : null,
        voidReason: row.void_reason,
        estimateId: row.estimate_id,
      };
    }),
    payments: paymentList,
    estimates: rows(estimates).map((row): Estimate => ({
      id: row.id,
      number: row.number,
      contactId: row.contact_id,
      items: linesByEstimate.get(row.id) ?? [],
      discountMinor: Number(row.discount_minor),
      taxRateBps: row.tax_rate_bps,
      notes: row.notes,
      subtotalMinor: Number(row.subtotal_minor),
      taxMinor: Number(row.tax_minor),
      amountMinor: Number(row.total_minor),
      currency: row.currency,
      status: row.status,
      issuedOn: row.issued_on,
      validUntil: row.valid_until,
      convertedInvoiceId: row.converted_invoice_id,
    })),
    expenses: rows(expenses).map((row): Expense => ({
      id: row.id,
      date: row.spent_on,
      vendor: row.vendor,
      category: row.category,
      description: row.description,
      amountMinor: Number(row.amount_minor),
      currency: row.currency,
      paymentMethod: row.payment_method,
      notes: row.notes,
      projectId: row.project_id,
      receiptPath: row.receipt_path,
      archived: row.archived_at !== null,
    })),
    truncated: [invoices, payments, estimates, expenses].some(
      (result) => (result.data?.length ?? 0) >= ROW_CAP,
    ),
  };
}
