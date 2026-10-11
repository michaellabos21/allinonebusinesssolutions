"use client";

import { Ban, BadgeCheck, Pencil, Printer, ReceiptText, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Panel } from "@/components/common/panel";
import { InvoiceStatusBadge } from "@/components/common/status-badge";
import { BackLink, MissingRecord } from "@/components/crm/shared";
import {
  InvoiceActionDialogs,
  PAYMENT_METHOD_LABEL,
  useInvoiceActions,
} from "@/components/money/invoice-actions";
import { InvoiceDocument } from "@/components/money/invoice-document";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { describeDue, formatDate, formatMoney } from "@/lib/format";
import { balanceMinor, invoiceDisplayStatus } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type { BillTo } from "@/mocks";

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const store = useDemoStore();
  const actions = useInvoiceActions();

  const invoice = store.invoices.find((item) => item.id === id);
  if (!invoice) {
    return (
      <MissingRecord
        icon={ReceiptText}
        noun="invoice"
        listHref="/money/invoices"
        listLabel="Back to invoices"
      />
    );
  }

  const display = invoiceDisplayStatus(invoice);
  const contact = store.contacts.find((item) => item.id === invoice.contactId);
  const company = store.contactCompanyName(invoice.contactId);
  // An issued invoice keeps who it was addressed to on the day; a draft shows the contact as now.
  const billTo: BillTo | null =
    invoice.billTo ??
    (contact ? { name: contact.name, email: contact.email, company, address: "" } : null);
  const payments = store.payments.filter((payment) => payment.invoiceId === invoice.id);
  const owed = balanceMinor(invoice);
  const money = (amount: number) => formatMoney(amount, { currency: invoice.currency });
  const open = invoice.status === "sent" || invoice.status === "partially_paid";

  return (
    <div className="page-container space-y-6">
      <BackLink href="/money/invoices" label="Invoices" />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="tabular font-display text-title">{invoice.number ?? "Draft invoice"}</h1>
            <InvoiceStatusBadge status={display} />
          </div>
          <p className="mt-0.5 text-muted-foreground">
            {billTo ? billTo.company || billTo.name : "No client yet"}
            {invoice.description ? `, ${invoice.description}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {invoice.status === "draft" ? (
            <>
              <Button variant="outline" onClick={() => actions.askDelete(invoice)}>
                <Trash2 data-icon="inline-start" aria-hidden />
                Delete
              </Button>
              <Button asChild variant="outline">
                <Link href={`/money/invoices/${invoice.id}/edit`}>
                  <Pencil data-icon="inline-start" aria-hidden />
                  Edit draft
                </Link>
              </Button>
              <Button className="hover:bg-primary-hover" onClick={() => actions.askIssue(invoice)}>
                <Send data-icon="inline-start" aria-hidden />
                Issue invoice
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer data-icon="inline-start" aria-hidden />
              Print or save PDF
            </Button>
          )}
          {invoice.status === "sent" ? (
            <Button variant="outline" onClick={() => actions.askVoid(invoice)}>
              <Ban data-icon="inline-start" aria-hidden />
              Void
            </Button>
          ) : null}
          {open ? (
            <Button className="hover:bg-primary-hover" onClick={() => actions.askPayment(invoice)}>
              <BadgeCheck data-icon="inline-start" aria-hidden />
              Record payment
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <InvoiceDocument
          workspaceName={store.account.workspace.name}
          billTo={billTo}
          doc={{
            kind: "Invoice",
            number: invoice.number,
            currency: invoice.currency,
            issuedOn: invoice.issuedOn,
            endsOn: invoice.dueOn,
            items: invoice.items,
            subtotalMinor: invoice.subtotalMinor,
            discountMinor: invoice.discountMinor,
            taxRateBps: invoice.taxRateBps,
            taxMinor: invoice.taxMinor,
            totalMinor: invoice.amountMinor,
            paidMinor: invoice.paidMinor,
            notes: invoice.notes,
            void: invoice.status === "void",
          }}
        />

        <div className="space-y-6">
          <Panel title="Status">
            <p className={cn(display === "overdue" && "font-medium text-danger")}>
              {invoice.status === "draft"
                ? "A draft. It has no number yet and the client hasn’t seen it."
                : invoice.status === "void"
                  ? `Voided: ${invoice.voidReason}`
                  : invoice.status === "paid"
                    ? `Paid in full${invoice.paidOn ? ` on ${formatDate(invoice.paidOn, "long")}` : ""}.`
                    : `${money(owed)} still owed. ${describeDue(invoice.dueOn).label[0].toUpperCase()}${describeDue(invoice.dueOn).label.slice(1)}.`}
            </p>
            {invoice.status !== "draft" ? (
              <dl className="mt-4 space-y-1.5 border-t pt-3">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Total</dt>
                  <dd className="tabular">{money(invoice.amountMinor)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Paid</dt>
                  <dd className="tabular">{money(invoice.paidMinor)}</dd>
                </div>
                <div className="flex justify-between gap-4 font-medium">
                  <dt>Balance</dt>
                  <dd className="tabular">{money(owed)}</dd>
                </div>
              </dl>
            ) : null}
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              Payments are recorded by hand. No money moves through this app, and nothing is emailed
              to the client.
            </p>
          </Panel>

          {invoice.status !== "draft" ? (
            <Panel title="Payments">
              {payments.length === 0 ? (
                <p className="text-muted-foreground">None recorded yet.</p>
              ) : (
                <ol className="space-y-3">
                  {payments.map((payment) => (
                    <li key={payment.id} className="flex justify-between gap-4">
                      <span>
                        <span className="block">{PAYMENT_METHOD_LABEL[payment.method]}</span>
                        <span className="tabular block text-caption text-muted-foreground">
                          {formatDate(payment.paidOn, "long")}
                          {payment.reference ? `, ${payment.reference}` : ""}
                        </span>
                        {payment.note ? (
                          <span className="block text-caption text-muted-foreground">
                            {payment.note}
                          </span>
                        ) : null}
                      </span>
                      <span className="tabular font-medium">{money(payment.amountMinor)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          ) : null}

          <Panel title="Client">
            {contact ? (
              <dl className="space-y-3">
                <div>
                  <dt className="text-caption text-muted-foreground">Contact</dt>
                  <dd>
                    <Link
                      href={`/crm/contacts/${contact.id}`}
                      className="text-primary hover:underline"
                    >
                      {contact.name}
                    </Link>
                  </dd>
                </div>
                {contact.companyId ? (
                  <div>
                    <dt className="text-caption text-muted-foreground">Company</dt>
                    <dd>
                      <Link
                        href={`/crm/companies/${contact.companyId}`}
                        className="text-primary hover:underline"
                      >
                        {company}
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-muted-foreground">No contact is linked to this invoice.</p>
            )}
            {invoice.estimateId ? (
              <p className="mt-3 border-t pt-3 text-caption">
                <Link
                  href={`/money/estimates/${invoice.estimateId}`}
                  className="text-primary hover:underline"
                >
                  Made from an estimate
                </Link>
              </p>
            ) : null}
          </Panel>
        </div>
      </div>

      <InvoiceActionDialogs {...actions.dialogs} />
    </div>
  );
}
