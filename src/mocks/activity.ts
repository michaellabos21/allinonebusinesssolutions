import type { ActivityEntry, Notification } from "./types";

/** Each entry mirrors a real change in the other demo files. Newest first. */
export const activity: ActivityEntry[] = [
  { id: "a1", kind: "invoice", actor: "Paolo Reyes", action: "drafted invoice INV-1038 for Verde Farm Co-op", at: "2026-10-10T16:20:00", href: "/money/invoices" },
  { id: "a2", kind: "invoice", actor: "Verde Farm Co-op", action: "paid invoice INV-1034", at: "2026-10-09T10:05:00", href: "/money/invoices" },
  { id: "a3", kind: "task", actor: "Tomas Villareal", action: "completed “Collect dietary icons for menu filters”", at: "2026-10-07T15:40:00", href: "/work/projects/p1", projectId: "p1" },
  { id: "a4", kind: "invoice", actor: "Mara Dalisay", action: "sent invoice INV-1036 to Mercado Dental Clinic", at: "2026-10-06T11:15:00", href: "/money/invoices" },
  { id: "a5", kind: "task", actor: "Mara Dalisay", action: "completed “Confirm clinic signage dimensions”", at: "2026-10-06T09:30:00", href: "/work/projects/p3", projectId: "p3" },
  { id: "a6", kind: "deal", actor: "Paolo Reyes", action: "moved Ong Hardware Supply’s e-commerce store to Negotiation", at: "2026-10-05T14:00:00", href: "/crm/deals" },
  { id: "a7", kind: "invoice", actor: "Ong Hardware Supply", action: "paid invoice INV-1033", at: "2026-10-03T13:25:00", href: "/money/invoices" },
  { id: "a8", kind: "invoice", actor: "Mara Dalisay", action: "sent invoice INV-1035 to Kusina Lokal", at: "2026-10-01T10:00:00", href: "/money/invoices" },
  { id: "a9", kind: "project", actor: "Jenna Lim", action: "started project “Verde Farm packaging labels”", at: "2026-09-21T09:00:00", href: "/work/projects/p6", projectId: "p6" },
  { id: "a10", kind: "task", actor: "Paolo Reyes", action: "completed “Archive annual report source files”", at: "2026-09-15T17:10:00", href: "/work/projects/p5", projectId: "p5" },
  { id: "a11", kind: "project", actor: "Jenna Lim", action: "started project “Mercado Dental brand kit”", at: "2026-09-07T09:00:00", href: "/work/projects/p3", projectId: "p3" },
  { id: "a12", kind: "project", actor: "Tomas Villareal", action: "started project “Ong Hardware catalog refresh”", at: "2026-09-01T09:00:00", href: "/work/projects/p2", projectId: "p2" },
  { id: "a13", kind: "project", actor: "Mara Dalisay", action: "started project “Isla Surf booking page”", at: "2026-07-27T09:00:00", href: "/work/projects/p4", projectId: "p4" },
  { id: "a14", kind: "project", actor: "Paolo Reyes", action: "started project “Tan & Uy annual report layout”", at: "2026-07-06T09:00:00", href: "/work/projects/p5", projectId: "p5" },
  { id: "a15", kind: "project", actor: "Paolo Reyes", action: "started project “Kusina Lokal online ordering site”", at: "2026-06-22T09:00:00", href: "/work/projects/p1", projectId: "p1" },
];

export const notifications: Notification[] = [
  { id: "n1", title: "Invoice INV-1037 is 11 days overdue", body: "Isla Surf Hostel, due 30 Sep", at: "2026-10-11T08:00:00", href: "/money/invoices", read: false },
  { id: "n2", title: "Task due today", body: "Review menu page copy with Bianca", at: "2026-10-11T07:30:00", href: "/work/tasks", read: false },
  { id: "n3", title: "Payment received", body: "Verde Farm Co-op paid INV-1034", at: "2026-10-09T10:05:00", href: "/money/invoices", read: false },
  { id: "n4", title: "Paolo mentioned you", body: "On the Ong Hardware e-commerce deal", at: "2026-10-05T14:10:00", href: "/crm/deals", read: true },
];
