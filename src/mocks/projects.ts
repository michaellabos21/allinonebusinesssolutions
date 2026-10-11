import type { Project } from "./types";

const project = (
  id: string,
  name: string,
  contactId: string,
  ownerId: string,
  status: Project["status"],
  startOn: string,
  dueOn: string,
  description: string,
): Project => ({ id, name, contactId, ownerId, status, startOn, dueOn, description });

export const projects: Project[] = [
  project("p1", "Kusina Lokal online ordering site", "c1", "u2", "active", "2026-06-22", "2026-11-14", "Menu browsing, pickup and delivery ordering, and a payment page for three branches. Has to be live before the December rush."),
  project("p2", "Ong Hardware catalog refresh", "c2", "u4", "active", "2026-09-01", "2026-10-30", "Reshoot the power tools range and rebuild the print and PDF catalog for the fourth quarter."),
  project("p3", "Mercado Dental brand kit", "c3", "u3", "active", "2026-09-07", "2026-10-24", "Logo, palette, signage templates and a handover folder the clinic can use without us."),
  project("p4", "Isla Surf booking page", "c4", "u1", "on_hold", "2026-07-27", "2026-11-28", "Room booking page with a calendar widget. Paused while the hostel renovates."),
  project("p5", "Tan & Uy annual report layout", "c5", "u2", "completed", "2026-07-06", "2026-09-12", "Layout and print files for the firm\u2019s annual report."),
  project("p6", "Verde Farm packaging labels", "c6", "u3", "active", "2026-09-21", "2026-12-05", "Labels for the 250g and 1kg packs, including regulatory panels and print-ready files."),
];
