import type { Contact, Note } from "./types";

/** Tags offered as filters and suggestions. Contacts may carry others. */
export const CONTACT_TAGS = ["Decision maker", "Billing", "Retainer", "Referral"];

const contact = (
  id: string,
  name: string,
  email: string,
  phone: string,
  companyId: string,
  status: Contact["status"],
  tags: string[],
  createdOn: string,
): Contact => ({ id, name, email, phone, companyId, status, tags, createdOn, archived: false });

export const contacts: Contact[] = [
  contact("c1", "Bianca Soriano", "bianca@kusinalokal.example", "0917 555 0101", "co1", "active", ["Decision maker"], "2026-03-02"),
  contact("c2", "Rafael Ong", "rafael@onghardware.example", "0917 555 0102", "co2", "active", ["Decision maker", "Retainer"], "2026-03-19"),
  contact("c3", "Liza Mercado", "liza@mercadodental.example", "0917 555 0103", "co3", "active", ["Decision maker", "Referral"], "2026-04-08"),
  contact("c4", "Carlo Javier", "carlo@islasurf.example", "0917 555 0104", "co4", "active", ["Decision maker"], "2026-05-21"),
  contact("c5", "Andrea Tan", "andrea@tanuy.example", "0917 555 0105", "co5", "active", ["Decision maker"], "2026-02-11"),
  contact("c6", "Miguel Santos", "miguel@verdefarm.example", "0917 555 0106", "co6", "active", ["Decision maker", "Referral"], "2026-06-15"),
  contact("c7", "Jun Soriano", "jun@kusinalokal.example", "0917 555 0107", "co1", "active", ["Billing"], "2026-06-30"),
  contact("c8", "Grace Uy", "grace@tanuy.example", "0917 555 0108", "co5", "active", ["Billing"], "2026-02-14"),
  contact("c9", "Elena Ramos", "elena@baysidedental.example", "0917 555 0109", "co7", "lead", ["Referral"], "2026-09-08"),
  contact("c10", "Marco Dizon", "marco@panaycoffee.example", "0917 555 0110", "co8", "lead", ["Decision maker"], "2026-09-17"),
  contact("c11", "Tess Navarro", "tess@lakbaytours.example", "0917 555 0111", "co9", "lead", [], "2026-09-30"),
  contact("c12", "Noel Ong", "noel@onghardware.example", "0917 555 0112", "co2", "inactive", [], "2026-03-25"),
];

export const notes: Note[] = [
  { id: "n-1", contactId: "c1", authorId: "u1", body: "Wants the ordering site live before the December rush. Menu photos are coming from their own photographer.", at: "2026-10-02T14:10:00" },
  { id: "n-2", contactId: "c1", authorId: "u2", body: "Asked about a loyalty app as a follow-on. Proposal sent.", at: "2026-09-22T10:30:00" },
  { id: "n-3", contactId: "c4", authorId: "u1", body: "Booking page is paused while they renovate. Carlo says the design invoice will be settled once they reopen.", at: "2026-10-05T16:45:00" },
  { id: "n-4", contactId: "c3", authorId: "u3", body: "Prefers the teal palette. Liza was referred by Andrea at Tan & Uy.", at: "2026-09-18T09:20:00" },
  { id: "n-5", contactId: "c9", authorId: "u2", body: "Three clinics, one shared website. Budget to be confirmed after their board meets.", at: "2026-09-10T11:00:00" },
];
