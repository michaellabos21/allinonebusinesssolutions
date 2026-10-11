import { z } from "zod";

import { CURRENCY_OPTIONS, TAX_OPTIONS } from "@/config/app";
import { ASSIGNABLE_ROLES } from "@/server/permissions";

/**
 * Input rules shared by server actions. Every action parses its input with one
 * of these before doing anything else; the database repeats the important
 * limits as constraints.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter an email address.")
  .max(254, "That email address is too long.")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter an email address like name@company.com.");

const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use 72 characters or fewer.");

const timezone = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid time zone.");

const currencyCodes = CURRENCY_OPTIONS.map((option) => option.code) as [string, ...string[]];
const taxRates = TAX_OPTIONS.map((option) => option.bps) as number[];

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120, "Use 120 characters or fewer."),
  email,
  password,
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const emailOnlySchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "The two passwords don’t match.",
  });

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Enter a workspace name.").max(80, "Use 80 characters or fewer."),
  timezone,
  country: z.string().regex(/^[A-Z]{2}$/, "Choose a country."),
  currency: z.enum(currencyCodes, "Choose a currency."),
});

/** Letters, digits, dashes and slashes, up to 12; may be empty. */
const documentPrefix = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9/-]{0,12}$/, "Use up to 12 letters, digits, dashes or slashes.");

export const workspaceSettingsSchema = z.object({
  name: z.string().trim().min(1, "Enter a workspace name.").max(80, "Use 80 characters or fewer."),
  currency: z.enum(currencyCodes, "Choose a currency."),
  taxRateBps: z.coerce
    .number()
    .refine((value) => taxRates.includes(value), "Choose one of the listed tax options."),
  paymentTermDays: z.coerce
    .number("Enter a whole number of days from 0 to 90.")
    .int("Enter a whole number of days from 0 to 90.")
    .min(0, "Enter a whole number of days from 0 to 90.")
    .max(90, "Enter a whole number of days from 0 to 90."),
  invoicePrefix: documentPrefix,
  estimatePrefix: documentPrefix,
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(120, "Use 120 characters or fewer."),
  jobTitle: z.string().trim().max(120, "Use 120 characters or fewer."),
});

export const preferencesSchema = z.object({
  dateFormat: z.enum(["dmy", "mdy"]),
  weekStartsOn: z.coerce.number().refine((value) => value === 0 || value === 1),
});

export const NOTIFICATION_COLUMNS = {
  invoiceOverdue: "notify_invoice_overdue",
  paymentReceived: "notify_payment_received",
  taskDue: "notify_task_due",
  mentions: "notify_mentions",
  weeklySummary: "notify_weekly_summary",
} as const;

export const notificationPrefSchema = z.object({
  id: z.enum(Object.keys(NOTIFICATION_COLUMNS) as [keyof typeof NOTIFICATION_COLUMNS]),
  enabled: z.boolean(),
});

export const inviteSchema = z.object({
  email,
  role: z.enum(ASSIGNABLE_ROLES, "Choose a role."),
});

export const memberRoleSchema = z.object({
  membershipId: z.uuid(),
  role: z.enum(ASSIGNABLE_ROLES),
});

export const idSchema = z.uuid();

// ---------------------------------------------------------------------------
// Business records
// ---------------------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max, `Use ${max} characters or fewer.`);
const requiredText = (max: number, missing: string) => text(max).min(1, missing);
const optionalId = z.union([z.uuid(), z.null()]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");

export const companySchema = z.object({
  name: requiredText(120, "Enter the company’s name."),
  type: z.enum(["client", "prospect"]),
  industry: text(80),
  city: text(80),
  website: text(200),
  phone: text(40),
  address: text(300),
  notes: text(2000),
});

export const contactSchema = z.object({
  name: requiredText(120, "Enter the contact’s name."),
  email,
  phone: text(40),
  title: text(120),
  /** Matched to a company by name, or created when new. Empty for none. */
  companyName: text(120),
  status: z.enum(["active", "lead", "inactive"]),
  tags: z
    .array(z.string().trim().min(1).max(40, "Keep each tag to 40 characters or fewer."))
    .max(12, "Use 12 tags or fewer."),
});

export const noteSchema = z.object({
  contactId: z.uuid(),
  body: requiredText(4000, "Write a note before saving."),
});

export const catalogItemSchema = z.object({
  name: requiredText(120, "Give the item a name."),
  description: text(1000),
  type: z.enum(["service", "product"]),
  unitPriceMinor: z
    .number()
    .int()
    .positive("Enter a price above zero.")
    .max(100_000_000_000, "That price is too large."),
  unit: requiredText(30, "Say what one unit is, like hour or page."),
});

export const projectSchema = z.object({
  name: requiredText(160, "Give the project a name."),
  description: text(2000),
  contactId: optionalId,
  ownerId: z.uuid("Choose an owner."),
  status: z.enum(["active", "on_hold", "completed"]),
  dueOn: isoDate,
});

export const taskSchema = z.object({
  title: requiredText(200, "Describe the task."),
  description: text(2000),
  projectId: optionalId,
  assigneeId: z.uuid("Choose an assignee."),
  status: z.enum(["todo", "in_progress", "done"]),
  priority: z.enum(["low", "medium", "high"]),
  dueOn: isoDate,
});

export const taskStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["todo", "in_progress", "done"]),
});

export const archiveSchema = z.object({ id: z.uuid(), archived: z.boolean() });

// ---------------------------------------------------------------------------
// Sales pipeline
// ---------------------------------------------------------------------------

const money = z
  .number("Enter an amount.")
  .int()
  .min(0, "Enter zero or more.")
  .max(100_000_000_000, "That amount is too large.");

/** Empty, or a valid email address. Leads may arrive without one. */
const optionalEmail = z.union([z.literal(""), email]);

export const leadSchema = z.object({
  name: requiredText(120, "Enter the lead’s name."),
  email: optionalEmail,
  phone: text(40),
  companyName: text(120),
  source: text(80),
  status: z.enum(["new", "contacted", "qualified", "disqualified"]),
  notes: text(4000),
  ownerId: optionalId,
});

export const dealSchema = z.object({
  name: requiredText(160, "Give the deal a name."),
  /** Matched to a company by name, or created when new. Empty for none. */
  companyName: text(120),
  contactId: optionalId,
  ownerId: z.uuid("Choose an owner."),
  stageId: z.uuid("Choose a stage."),
  valueMinor: money,
  expectedCloseOn: isoDate,
  lostReason: text(300),
});

export const dealStageChangeSchema = z.object({
  id: z.uuid(),
  stageId: z.uuid(),
  lostReason: text(300),
});

export const convertLeadSchema = z.object({
  leadId: z.uuid(),
  /** A contact the user picked; otherwise one is matched by email or created. */
  contactId: optionalId,
  createDeal: z.boolean(),
  dealName: text(160),
  valueMinor: money,
  stageId: optionalId,
  expectedCloseOn: z.union([isoDate, z.null()]),
});

export const stageSchema = z.object({
  name: requiredText(40, "Name the stage."),
});

export const stageOrderSchema = z.array(z.uuid()).min(3).max(30);

export const leadFormSchema = z.object({
  name: requiredText(80, "Name the form."),
  intro: text(500),
  consentText: text(1000),
  successMessage: requiredText(300, "Write the message people see after sending."),
  active: z.boolean(),
});

/** What a visitor sends from a public form. Checked again by the database. */
export const publicLeadSchema = z.object({
  name: requiredText(120, "Enter your name."),
  email,
  phone: text(40),
  company: text(120),
  message: text(2000),
  consent: z.boolean(),
});

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

export const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "card",
  "e_wallet",
  "check",
  "other",
] as const;

const minorUnits = (max: number, message: string) =>
  z.number(message).int(message).min(0, message).max(max, "That amount is too large.");

export const documentLineSchema = z.object({
  description: requiredText(500, "Describe the line."),
  quantityMilli: z
    .number("Enter a quantity.")
    .int()
    .min(1, "Enter a quantity above zero.")
    .max(100_000_000, "That quantity is too large."),
  unitPriceMinor: minorUnits(100_000_000_000, "Enter a price."),
  catalogItemId: optionalId,
});

const documentFields = {
  contactId: optionalId,
  issuedOn: isoDate,
  discountMinor: minorUnits(10_000_000_000_000, "Enter a discount of zero or more."),
  taxRateBps: z.number().int().min(0).max(10_000),
  notes: text(2000),
  items: z
    .array(documentLineSchema)
    .min(1, "Add at least one line.")
    .max(100, "Use 100 lines or fewer."),
};

export const invoiceDraftSchema = z
  .object({ ...documentFields, dueOn: isoDate })
  .refine((value) => value.dueOn >= value.issuedOn, {
    path: ["dueOn"],
    message: "The due date can’t be before the issue date.",
  });

export const estimateDraftSchema = z
  .object({ ...documentFields, validUntil: isoDate })
  .refine((value) => value.validUntil >= value.issuedOn, {
    path: ["validUntil"],
    message: "The estimate can’t expire before it’s issued.",
  });

export const paymentSchema = z.object({
  invoiceId: z.uuid(),
  amountMinor: z.number("Enter an amount.").int().min(1, "Enter an amount above zero."),
  paidOn: isoDate,
  method: z.enum(PAYMENT_METHODS, "Choose how it was paid."),
  reference: text(120),
  note: text(500),
});

export const voidSchema = z.object({
  id: z.uuid(),
  reason: requiredText(300, "Say why the invoice is being voided."),
});

export const expenseSchema = z.object({
  date: isoDate,
  vendor: requiredText(120, "Who was paid?"),
  category: requiredText(60, "Choose a category."),
  description: text(500),
  amountMinor: z
    .number("Enter an amount.")
    .int()
    .min(1, "Enter an amount above zero.")
    .max(10_000_000_000_000, "That amount is too large."),
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: text(2000),
  projectId: optionalId,
});

/** Receipt files accepted for upload, and the most we accept. */
export const RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

/** One row of a contact import, after column mapping. */
export const importRowSchema = z.object({
  name: requiredText(120, "Name is missing."),
  email,
  phone: text(40).default(""),
  title: text(120).default(""),
  company: text(120).default(""),
  status: z
    .enum(["active", "lead", "inactive"], "Status must be active, lead or inactive.")
    .default("active"),
  tags: z.array(z.string().trim().min(1).max(40)).max(12, "Use 12 tags or fewer.").default([]),
});
export type ImportRow = z.infer<typeof importRowSchema>;

export const IMPORT_ROW_LIMIT = 500;

/** Turns a Zod failure into one message per field, for showing beside inputs. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
