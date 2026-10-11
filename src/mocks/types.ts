/** Shapes for the prototype's demo records. Money is always integer minor units (centavos). */

/** A fictional teammate on the demo records. Real members live in the database. */
export type TeamMember = {
  id: string;
  name: string;
  email: string;
  title: string;
  role: "Owner" | "Admin" | "Member";
};

export type CompanyType = "client" | "prospect";

export type Company = {
  id: string;
  name: string;
  industry: string;
  city: string;
  website: string;
  phone: string;
  address: string;
  notes: string;
  type: CompanyType;
  createdOn: string;
  archived: boolean;
};

export type ContactStatus = "active" | "lead" | "inactive";

export type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** Their role at the company, e.g. "Operations manager". */
  title: string;
  companyId: string | null;
  status: ContactStatus;
  tags: string[];
  createdOn: string;
  archived: boolean;
};

export type Note = {
  id: string;
  contactId: string;
  authorId: string;
  body: string;
  /** ISO date-time. */
  at: string;
};

export type ProjectStatus = "active" | "on_hold" | "completed";

export type Project = {
  id: string;
  name: string;
  description: string;
  contactId: string | null;
  ownerId: string;
  status: ProjectStatus;
  startOn: string;
  dueOn: string;
};

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  projectId: string | null;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueOn: string;
  description: string;
  /** Who added the task; decides whether a member may edit it. */
  createdBy: string | null;
};

/** "overdue" is never stored: it is derived from a sent invoice's due date. */
export type InvoiceStatus = "draft" | "sent" | "paid";
export type InvoiceDisplayStatus = InvoiceStatus | "overdue";

export type InvoiceItem = {
  id: string;
  description: string;
  /** Whole units only in this prototype. */
  quantity: number;
  unitPriceMinor: number;
};

export type Invoice = {
  id: string;
  number: string;
  contactId: string;
  /** Short summary shown in lists. */
  description: string;
  items: InvoiceItem[];
  /** Flat amount taken off the subtotal before tax. */
  discountMinor: number;
  /** Tax rate in basis points: 1200 is 12%. */
  taxRateBps: number;
  notes: string;
  /** The total. Always written by `computeInvoiceTotals`, never typed in. */
  amountMinor: number;
  status: InvoiceStatus;
  issuedOn: string;
  dueOn: string;
  paidOn: string | null;
};

export type CatalogItemType = "service" | "product";

export type CatalogItem = {
  id: string;
  name: string;
  description: string;
  type: CatalogItemType;
  unitPriceMinor: number;
  /** What one unit is, e.g. "hour" or "page". */
  unit: string;
  archived: boolean;
};

export type Expense = {
  id: string;
  /** `YYYY-MM-DD` */
  date: string;
  vendor: string;
  category: string;
  description: string;
  amountMinor: number;
  projectId: string | null;
};

export type StageKind = "open" | "won" | "lost";

/** A column of the workspace's pipeline. Won and lost stages close a deal. */
export type DealStage = {
  id: string;
  name: string;
  position: number;
  kind: StageKind;
  archived: boolean;
};

export type Deal = {
  id: string;
  name: string;
  companyId: string | null;
  contactId: string | null;
  ownerId: string;
  stageId: string;
  /** Copied from the stage when loaded, so totals need no lookup. */
  stageKind: StageKind;
  valueMinor: number;
  /** ISO 4217 code; amounts are minor units of it. */
  currency: string;
  expectedCloseOn: string;
  /** Set when the deal enters a won or lost stage. */
  closedOn: string | null;
  lostReason: string;
  /** The lead this deal was converted from, if any. */
  leadId: string | null;
  archived: boolean;
};

export type LeadStatus = "new" | "contacted" | "qualified" | "disqualified" | "converted";

/** An enquiry not yet qualified into a contact and deal. */
export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  source: string;
  status: LeadStatus;
  notes: string;
  /** Null for leads that arrived through a public form and are not yet assigned. */
  ownerId: string | null;
  formId: string | null;
  convertedContactId: string | null;
  convertedDealId: string | null;
  createdOn: string;
  archived: boolean;
};

/** A public enquiry form. Its token is the only thing in its link. */
export type LeadForm = {
  id: string;
  name: string;
  token: string;
  intro: string;
  consentText: string;
  successMessage: string;
  active: boolean;
  createdOn: string;
};

export type ActivityKind =
  "contact" | "company" | "project" | "task" | "invoice" | "deal" | "lead" | "expense" | "catalog";

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  /** Who did it — a team member's name or a client. */
  actor: string;
  /** Reads after the actor, e.g. "paid invoice INV-1034". */
  action: string;
  /** ISO date-time. */
  at: string;
  href: string;
  /** Set when the entry belongs to a project, so it shows on that project's page. */
  projectId?: string;
  /** Set when the entry belongs to a deal, so it shows in that deal's history. */
  dealId?: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  at: string;
  href: string;
  read: boolean;
};
