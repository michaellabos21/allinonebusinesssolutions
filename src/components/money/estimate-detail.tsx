"use client";

import { Check, FileText, Pencil, Printer, ReceiptText, Send, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Panel } from "@/components/common/panel";
import { EstimateStatusBadge } from "@/components/common/status-badge";
import { BackLink, MissingRecord } from "@/components/crm/shared";
import { EstimateActionDialogs, useEstimateActions } from "@/components/money/estimate-actions";
import { InvoiceDocument } from "@/components/money/invoice-document";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { estimateDisplayStatus } from "@/lib/metrics";
import type { BillTo } from "@/mocks";

const STATUS_TEXT = {
  draft: "A draft. It has no number yet and the client hasn’t seen it.",
  sent: "Sent and waiting for the client’s answer.",
  expired: "Past its “valid until” date with no answer. You can still record one.",
  accepted: "Accepted by the client.",
  declined: "Declined by the client.",
};

export function EstimateDetail() {
  const { id } = useParams<{ id: string }>();
  const store = useDemoStore();
  const actions = useEstimateActions();

  const estimate = store.estimates.find((item) => item.id === id);
  if (!estimate) {
    return (
      <MissingRecord
        icon={FileText}
        noun="estimate"
        listHref="/money/estimates"
        listLabel="Back to estimates"
      />
    );
  }

  const display = estimateDisplayStatus(estimate);
  const contact = store.contacts.find((item) => item.id === estimate.contactId);
  const company = store.contactCompanyName(estimate.contactId);
  const billTo: BillTo | null = contact
    ? { name: contact.name, email: contact.email, company, address: "" }
    : null;
  const invoice = store.invoices.find((item) => item.id === estimate.convertedInvoiceId);

  return (
    <div className="page-container space-y-6">
      <BackLink href="/money/estimates" label="Estimates" />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="tabular font-display text-title">
              {estimate.number ?? "Draft estimate"}
            </h1>
            <EstimateStatusBadge status={display} />
          </div>
          <p className="mt-0.5 text-muted-foreground">
            {billTo ? billTo.company || billTo.name : "No client yet"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {estimate.status === "draft" ? (
            <>
              <Button variant="outline" onClick={() => actions.askDelete(estimate)}>
                <Trash2 data-icon="inline-start" aria-hidden />
                Delete
              </Button>
              <Button asChild variant="outline">
                <Link href={`/money/estimates/${estimate.id}/edit`}>
                  <Pencil data-icon="inline-start" aria-hidden />
                  Edit draft
                </Link>
              </Button>
              <Button className="hover:bg-primary-hover" onClick={() => actions.askSend(estimate)}>
                <Send data-icon="inline-start" aria-hidden />
                Mark as sent
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer data-icon="inline-start" aria-hidden />
              Print or save PDF
            </Button>
          )}
          {estimate.status === "sent" ? (
            <>
              <Button variant="outline" onClick={() => actions.askDecline(estimate)}>
                <X data-icon="inline-start" aria-hidden />
                Declined
              </Button>
              <Button
                className="hover:bg-primary-hover"
                onClick={() => actions.askAccept(estimate)}
              >
                <Check data-icon="inline-start" aria-hidden />
                Accepted
              </Button>
            </>
          ) : null}
          {estimate.status === "accepted" && !estimate.convertedInvoiceId ? (
            <Button className="hover:bg-primary-hover" onClick={() => actions.askConvert(estimate)}>
              <ReceiptText data-icon="inline-start" aria-hidden />
              Create invoice
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_300px] print:block">
        <InvoiceDocument
          workspaceName={store.account.workspace.name}
          billTo={billTo}
          doc={{
            kind: "Estimate",
            number: estimate.number,
            currency: estimate.currency,
            issuedOn: estimate.issuedOn,
            endsOn: estimate.validUntil,
            items: estimate.items,
            subtotalMinor: estimate.subtotalMinor,
            discountMinor: estimate.discountMinor,
            taxRateBps: estimate.taxRateBps,
            taxMinor: estimate.taxMinor,
            totalMinor: estimate.amountMinor,
            notes: estimate.notes,
          }}
        />

        <div className="space-y-6 print:hidden">
          <Panel title="Status">
            <p>{STATUS_TEXT[display]}</p>
            {estimate.convertedInvoiceId ? (
              <p className="mt-3 border-t pt-3">
                <Link
                  href={`/money/invoices/${estimate.convertedInvoiceId}`}
                  className="text-primary hover:underline"
                >
                  {invoice?.number ? `Invoiced as ${invoice.number}` : "View the draft invoice"}
                </Link>
              </p>
            ) : null}
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              Nothing is emailed from this app. Valid until{" "}
              {formatDate(estimate.validUntil, "long")}.
            </p>
          </Panel>

          <Panel title="Client">
            {contact ? (
              <Link href={`/crm/contacts/${contact.id}`} className="text-primary hover:underline">
                {contact.name}
              </Link>
            ) : (
              <p className="text-muted-foreground">No contact is linked to this estimate.</p>
            )}
          </Panel>
        </div>
      </div>

      <EstimateActionDialogs {...actions.dialogs} />
    </div>
  );
}
