/**
 * Single source of truth for product-level settings.
 * Rename the product by changing PRODUCT_NAME — nothing else hardcodes it.
 */
export const PRODUCT_NAME = "Kasama";

export const PRODUCT_TAGLINE = "Clients, work and money in one place";

/** The name on the public landing page. */
export const MARKETING_NAME = PRODUCT_NAME;

/**
 * The landing page's video: a YouTube video id (the part after `v=` in its
 * link), or a file in `public/` such as `{ src: "/landing/demo.mp4" }`. The page
 * then shows a video section and a "Watch the video" button; null hides both.
 */
export const LANDING_VIDEO: { youtubeId: string } | { src: string; poster?: string } | null = {
  youtubeId: "ThFC4wwFB7M",
};

/** Shown anywhere the UI needs to explain that nothing is persisted. */
export const PROTOTYPE_NOTICE =
  "Everything you add is saved to your workspace. This is an early version: some areas, like emails and the client portal, are not built yet.";

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

/**
 * Notification switches shown in settings, each matching a `notify_*` column
 * on profiles. All but the weekly summary appear in the bell in the top bar.
 */
export const NOTIFICATION_OPTIONS = [
  {
    id: "taskAssigned",
    label: "Assigned to a task",
    description: "When a teammate assigns you a task.",
  },
  {
    id: "mentions",
    label: "Mentions",
    description: "When a teammate @mentions you in a task comment.",
  },
  {
    id: "taskComments",
    label: "Comments on your tasks",
    description: "New comments on tasks you’re assigned to or created.",
  },
  {
    id: "taskDue",
    label: "Task due today",
    description: "A reminder for your open tasks on the day they’re due.",
  },
  {
    id: "paymentReceived",
    label: "Payment recorded",
    description: "When a payment is recorded on an invoice. Managers and above.",
  },
  {
    id: "invoiceOverdue",
    label: "Invoice becomes overdue",
    description: "When an issued invoice passes its due date. Managers and above.",
  },
  {
    id: "newLeads",
    label: "New leads from forms",
    description: "When someone sends an enquiry through one of your lead forms.",
  },
  {
    id: "weeklySummary",
    label: "Weekly summary email",
    description: "Revenue, open invoices and overdue tasks every Monday. Emails aren’t sent yet.",
  },
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

/** Countries offered when creating a workspace. ISO 3166-1 alpha-2 codes. */
export const COUNTRY_OPTIONS = [
  { code: "PH", label: "Philippines" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "DE", label: "Germany" },
  { code: "GB", label: "United Kingdom" },
  { code: "HK", label: "Hong Kong" },
  { code: "ID", label: "Indonesia" },
  { code: "IE", label: "Ireland" },
  { code: "IN", label: "India" },
  { code: "JP", label: "Japan" },
  { code: "MY", label: "Malaysia" },
  { code: "NZ", label: "New Zealand" },
  { code: "SG", label: "Singapore" },
  { code: "TH", label: "Thailand" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "US", label: "United States" },
  { code: "VN", label: "Vietnam" },
] as const;
