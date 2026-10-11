/**
 * Single source of truth for product-level settings.
 * Rename the product by changing PRODUCT_NAME — nothing else hardcodes it.
 */
export const PRODUCT_NAME = "Workspace";

export const PRODUCT_TAGLINE = "Clients, work and money in one place";

/** Shown anywhere the UI needs to explain that nothing is persisted. */
export const PROTOTYPE_NOTICE =
  "UI prototype. Records are sample data and anything you add lasts for this session only.";

/** Workspace-level formatting defaults (editable in a later settings phase). */
export const WORKSPACE_DEFAULTS = {
  currency: "PHP",
  locale: "en-PH",
  /** Basis points applied to new invoices: 0 is no tax. */
  taxRateBps: 0,
  /** Days from issue to due date on a new invoice. */
  paymentTermDays: 15,
} as const;

/**
 * Demo tax choices for invoices. These are placeholders, not tax advice:
 * real rates will come from workspace settings in a later phase.
 */
/**
 * Accent choices in appearance settings. Each is dark enough for white text
 * (4.5:1 or better) and comes with its hover and tint steps.
 */
export const ACCENTS = [
  { id: "indigo", label: "Indigo", primary: "#34479e", hover: "#2a3a85", soft: "#eceef8" },
  { id: "teal", label: "Teal", primary: "#0f6b66", hover: "#0b5551", soft: "#e3f1f0" },
  { id: "plum", label: "Plum", primary: "#6b3a7d", hover: "#572e66", soft: "#f2eaf5" },
  { id: "slate", label: "Slate", primary: "#3b4658", hover: "#2e3746", soft: "#eceef1" },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];

/** Notification switches shown in settings. Nothing is sent in the prototype. */
export const NOTIFICATION_OPTIONS = [
  { id: "invoiceOverdue", label: "Invoice becomes overdue", description: "When a sent invoice passes its due date." },
  { id: "paymentReceived", label: "Payment recorded", description: "When an invoice is marked as paid." },
  { id: "taskDue", label: "Task due today", description: "A morning reminder for tasks assigned to you." },
  { id: "mentions", label: "Mentions", description: "When a teammate mentions you in a note." },
  { id: "weeklySummary", label: "Weekly summary email", description: "Revenue, open invoices and overdue tasks every Monday." },
] as const;
export type NotificationPrefId = (typeof NOTIFICATION_OPTIONS)[number]["id"];

/** Currencies offered in settings, each with the locale used to format it. */
export const CURRENCY_OPTIONS = [
  { code: "PHP", label: "Philippine peso (PHP)", locale: "en-PH" },
  { code: "USD", label: "US dollar (USD)", locale: "en-US" },
  { code: "EUR", label: "Euro (EUR)", locale: "en-IE" },
  { code: "SGD", label: "Singapore dollar (SGD)", locale: "en-SG" },
  { code: "AUD", label: "Australian dollar (AUD)", locale: "en-AU" },
] as const;

export const TAX_OPTIONS = [
  { bps: 0, label: "No tax" },
  { bps: 1200, label: "VAT 12%" },
] as const;

/**
 * The demo data is written around a fixed "today" so that due dates, overdue
 * invoices and month-to-date totals always reconcile, whenever the app is run.
 */
export const DEMO_TODAY = "2026-10-11";
