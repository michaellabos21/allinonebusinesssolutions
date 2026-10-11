import { getOpenDeals, invoiceDisplayStatus } from "@/lib/metrics";
import type { Company, Contact, Deal, Invoice, Note } from "@/mocks";
import { memberName } from "@/lib/runtime";

export type TimelineEvent = {
  id: string;
  kind: "created" | "note" | "invoice" | "payment";
  title: string;
  detail?: string;
  /** ISO date or date-time. */
  at: string;
};

/**
 * A contact's history, built from the records that reference them so the
 * timeline can never disagree with the related lists beside it.
 */
export function getContactTimeline(
  contact: Contact,
  { notes, invoices }: { notes: Note[]; invoices: Invoice[] },
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: `created-${contact.id}`,
      kind: "created",
      title: "Added as a contact",
      at: contact.createdOn,
    },
  ];

  for (const note of notes) {
    if (note.contactId !== contact.id) continue;
    const author = memberName(note.authorId);
    events.push({
      id: note.id,
      kind: "note",
      title: `${author} added a note`,
      detail: note.body,
      at: note.at,
    });
  }

  for (const invoice of invoices) {
    if (invoice.contactId !== contact.id) continue;
    events.push({
      id: `issued-${invoice.id}`,
      kind: "invoice",
      title: `Invoice ${invoice.number} ${invoice.status === "draft" ? "drafted" : "sent"}`,
      detail: invoice.description,
      at: invoice.issuedOn,
    });
    if (invoice.paidOn) {
      events.push({
        id: `paid-${invoice.id}`,
        kind: "payment",
        title: `Invoice ${invoice.number} paid`,
        at: invoice.paidOn,
      });
    }
  }

  return events.sort((a, b) => b.at.localeCompare(a.at));
}

/** Figures for a company, rolled up from its contacts' records. */
export function getCompanyRollup(
  company: Company,
  { contacts, deals, invoices }: { contacts: Contact[]; deals: Deal[]; invoices: Invoice[] },
) {
  const people = contacts.filter(
    (contact) => contact.companyId === company.id && !contact.archived,
  );
  const contactIds = new Set(
    contacts.filter((contact) => contact.companyId === company.id).map((contact) => contact.id),
  );
  const companyInvoices = invoices.filter((invoice) => contactIds.has(invoice.contactId));
  const billed = companyInvoices.filter((invoice) => invoice.status !== "draft");
  const unpaid = billed.filter((invoice) => invoice.status === "sent");
  const companyDeals = deals.filter((deal) => deal.companyId === company.id && !deal.archived);
  const openDeals = getOpenDeals(companyDeals);
  const sum = (items: { amountMinor: number }[]) =>
    items.reduce((total, item) => total + item.amountMinor, 0);

  return {
    people,
    contactIds,
    invoices: companyInvoices,
    deals: companyDeals,
    openDealCount: openDeals.length,
    openDealMinor: openDeals.reduce((total, deal) => total + deal.valueMinor, 0),
    billedMinor: sum(billed),
    unpaidMinor: sum(unpaid),
    overdueCount: unpaid.filter((invoice) => invoiceDisplayStatus(invoice) === "overdue").length,
  };
}
