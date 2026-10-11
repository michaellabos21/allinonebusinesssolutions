"use client";

import { BadgeCheck, Pencil, ReceiptText, Send } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Panel } from "@/components/common/panel";
import { InvoiceStatusBadge } from "@/components/common/status-badge";
import { BackLink, MissingRecord } from "@/components/crm/shared";
import { PaymentDialog, useInvoiceActions } from "@/components/money/invoice-actions";
import { InvoiceDocument } from "@/components/money/invoice-document";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { describeDue, formatDate } from "@/lib/format";
import { invoiceDisplayStatus } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const store = useDemoStore();
  const actions = useInvoiceActions();

  const invoice = store.invoices.find((item) => item.id === id);
  if (!invoice) {
    return <MissingRecord icon={ReceiptText} noun="invoice" listHref="/money/invoices" listLabel="Back to invoices" />;
  }

  const display = invoiceDisplayStatus(invoice);
  const contact = store.contacts.find((item) => item.id === invoice.contactId);
  const company = store.contactCompanyName(invoice.contactId);
  const due = describeDue(invoice.dueOn);

  const steps = [
    { label: invoice.status === "draft" ? "Drafted" : "Issued", date: invoice.issuedOn, done: true },
    { label: "Sent to client", date: invoice.status === "draft" ? null : invoice.issuedOn, done: invoice.status !== "draft" },
    { label: "Paid", date: invoice.paidOn, done: invoice.status === "paid" },
  ];

  return (
    <div className="page-container space-y-6">
      <BackLink href="/money/invoices" label="Invoices" />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="tabular font-display text-title">{invoice.number}</h1>
            <InvoiceStatusBadge status={display} />
          </div>
          <p className="mt-0.5 text-muted-foreground">
            {company || contact?.name || "Unknown client"}, {invoice.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {invoice.status === "draft" ? (
            <>
              <Button asChild variant="outline">
                <Link href={`/money/invoices/${invoice.id}/edit`}>
                  <Pencil data-icon="inline-start" aria-hidden />
                  Edit draft
                </Link>
              </Button>
              <Button className="hover:bg-primary-hover" onClick={() => actions.markSent(invoice)}>
                <Send data-icon="inline-start" aria-hidden />
                Mark as sent
              </Button>
            </>
          ) : null}
          {invoice.status === "sent" ? (
            <Button className="hover:bg-primary-hover" onClick={() => actions.askPayment(invoice)}>
              <BadgeCheck data-icon="inline-start" aria-hidden />
              Record payment
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <InvoiceDocument
          invoice={invoice}
          workspaceName={store.workspace.name}
          billTo={{ name: contact?.name ?? "Unknown contact", company, email: contact?.email ?? "" }}
        />

        <div className="space-y-6">
          <Panel title="Status">
            <p className={cn(display === "overdue" && "font-medium text-danger")}>
              {invoice.status === "paid"
                ? `Paid in full on ${formatDate(invoice.paidOn ?? invoice.dueOn, "long")}.`
                : invoice.status === "draft"
                  ? "Still a draft. The client has not seen it."
                  : display === "overdue"
                    ? `${due.label[0].toUpperCase()}${due.label.slice(1)}.`
                    : `${due.label}.`}
            </p>
            <ol className="mt-4 space-y-3">
              {steps.map((step) => (
                <li key={step.label} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn("size-2.5 shrink-0 rounded-full border", step.done ? "border-primary bg-primary" : "bg-card")}
                  />
                  <span className={cn("flex-1", !step.done && "text-muted-foreground")}>
                    {step.label}
                    <span className="sr-only">{step.done ? " (done)" : " (not yet)"}</span>
                  </span>
                  <span className="tabular text-caption text-muted-foreground">
                    {step.date ? formatDate(step.date) : "Not yet"}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              Sending and payments are simulated. Nothing is emailed and no money moves.
            </p>
          </Panel>

          <Panel title="Client">
            {contact ? (
              <dl className="space-y-3">
                <div>
                  <dt className="text-caption text-muted-foreground">Contact</dt>
                  <dd>
                    <Link href={`/crm/contacts/${contact.id}`} className="text-primary hover:underline">
                      {contact.name}
                    </Link>
                  </dd>
                </div>
                {contact.companyId ? (
                  <div>
                    <dt className="text-caption text-muted-foreground">Company</dt>
                    <dd>
                      <Link href={`/crm/companies/${contact.companyId}`} className="text-primary hover:underline">
                        {company}
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-muted-foreground">The contact for this invoice is not available.</p>
            )}
          </Panel>
        </div>
      </div>

      <PaymentDialog {...actions.paymentDialog} />
    </div>
  );
}
