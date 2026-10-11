/**
 * Demo data for the UI prototype. Everything here is fictional.
 * Dashboard figures are computed from these records in `src/lib/metrics.ts`,
 * so edit the records, not the totals.
 */
export * from "./types";
export { teamMembers, currentUser } from "./team";
export { companies } from "./companies";
export { contacts, CONTACT_TAGS, notes } from "./contacts";
export { projects } from "./projects";
export { tasks, TASK_STATUSES } from "./tasks";
export { invoices } from "./invoices";
export { catalogItems } from "./catalog";
export { expenses, EXPENSE_CATEGORIES } from "./expenses";
export { deals, DEAL_STAGES, OPEN_DEAL_STAGES } from "./deals";
export { activity, notifications } from "./activity";
