/** Shapes for the prototype's demo records. Money is always integer minor units (centavos). */

/** A fictional teammate on the demo records. Real members live in the database. */
export type TeamMember = {
  id: string;
  name: string;
  email: string;
  title: string;
  /** Profile photo, served at /photos/<path>; absent or null shows initials. */
  photoPath?: string | null;
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
  /** Stored photo, served at /photos/<path>; null shows initials. */
  photoPath: string | null;
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

export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  projectId: string | null;
  /** Everyone assigned, in the order they were added. Empty when unassigned. */
  assigneeIds: string[];
  status: TaskStatus;
  priority: TaskPriority;
  /** `YYYY-MM-DD`, or null when the task has no due date. */
  dueOn: string | null;
  description: string;
  /** Who added the task; with the assignees, decides whether a member may edit it. */
  createdBy: string | null;
  /** Checklist progress, for lists and cards. */
  checklist: { done: number; total: number };
  /** Comments not deleted. */
  commentCount: number;
};

/** "overdue" is never stored: it is derived from a sent invoice's due date. */
/**
 * Stored statuses. "Overdue" is never stored: it follows from the due date
 * (see `invoiceDisplayStatus`), so it can't go stale.
 */
export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "void";
export type InvoiceDisplayStatus = InvoiceStatus | "overdue";

export type InvoiceItem = {
  id: string;
  description: string;
  /** Thousandths of a unit: 1.5 hours is 1500. */
  quantityMilli: number;
  unitPriceMinor: number;
  /** Written by the database from quantity and price, rounded once. */
  amountMinor: number;
  catalogItemId: string | null;
};

/** Who an issued invoice was addressed to, kept as it was on the day. */
export type BillTo = { name: string; email: string; company: string; address: string };

export type PaymentMethod = "cash" | "bank_transfer" | "card" | "e_wallet" | "check" | "other";

/** A payment recorded by hand. No money moves through the app. */
export type Payment = {
  id: string;
  invoiceId: string;
  amountMinor: number;
  paidOn: string;
  method: PaymentMethod;
  reference: string;
  note: string;
};

export type Invoice = {
  id: string;
  /** Given when the invoice is issued; null for drafts. */
  number: string | null;
  contactId: string | null;
  /** Set when issued. */
  billTo: BillTo | null;
  /** Short summary shown in lists: the first line's description. */
  description: string;
  items: InvoiceItem[];
  /** Flat amount taken off the subtotal before tax. */
  discountMinor: number;
  /** Tax rate in basis points: 1200 is 12%. */
  taxRateBps: number;
  notes: string;
  subtotalMinor: number;
  taxMinor: number;
  /** The total, computed by the database from the lines. */
  amountMinor: number;
  /** Sum of recorded payments. */
  paidMinor: number;
  currency: string;
  status: InvoiceStatus;
  issuedOn: string;
  dueOn: string;
  /** Date of the payment that settled it, when fully paid. */
  paidOn: string | null;
  voidReason: string;
  estimateId: string | null;
};

export type EstimateStatus = "draft" | "sent" | "accepted" | "declined";
/** "Expired" follows from the validity date, like "overdue" for invoices. */
export type EstimateDisplayStatus = EstimateStatus | "expired";

export type Estimate = {
  id: string;
  number: string | null;
  contactId: string | null;
  items: InvoiceItem[];
  discountMinor: number;
  taxRateBps: number;
  notes: string;
  subtotalMinor: number;
  taxMinor: number;
  amountMinor: number;
  currency: string;
  status: EstimateStatus;
  issuedOn: string;
  validUntil: string;
  convertedInvoiceId: string | null;
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
  currency: string;
  paymentMethod: PaymentMethod;
  notes: string;
  projectId: string | null;
  /** Path in the private receipts bucket, when a receipt was attached. */
  receiptPath: string | null;
  archived: boolean;
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
  /** Set when the entry belongs to a task, so it shows in that task's history. */
  taskId?: string;
};

export type NotificationKind =
  | "task_assigned"
  | "task_mentioned"
  | "task_comment"
  | "task_due"
  | "invoice_paid"
  | "invoice_overdue"
  | "lead_new";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string;
  href: string;
  read: boolean;
};

/** The bell's contents: the latest notifications and how many are unread in all. */
export type NotificationFeed = {
  items: Notification[];
  unread: number;
  /** When the server read them, so the newest copy wins on the client. */
  loadedAt: number;
};
