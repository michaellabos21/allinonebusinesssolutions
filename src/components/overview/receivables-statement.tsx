"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { useDemoStore } from "@/components/providers/demo-store";
import { DEMO_TODAY } from "@/config/app";
import { Button } from "@/components/ui/button";
import { describeDue, formatMoney } from "@/lib/format";
import { getOpenInvoices, invoiceDisplayStatus } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const VISIBLE_LINES = 4;

const sum = (items: { amountMinor: number }[]) =>
  items.reduce((total, item) => total + item.amountMinor, 0);

const countLabel = (count: number) => `${count} ${count === 1 ? "invoice" : "invoices"}`;

/**
 * The overview's lead: what clients still owe, said as a sentence, with the
 * open invoices set out like lines on a statement.
 */
export function ReceivablesStatement() {
  const { invoices, contactCompanyName, openQuickCreate } = useDemoStore();
  const open = getOpenInvoices(invoices);
  const overdue = open.filter((invoice) => invoiceDisplayStatus(invoice) === "overdue");
  const drafts = invoices.filter((invoice) => invoice.status === "draft");
  const openMinor = sum(open);
  const overdueMinor = sum(overdue);
  const notDueMinor = openMinor - overdueMinor;
  const client = (contactId: string) => contactCompanyName(contactId) || "Unknown client";

  const headline =
    open.length > 0
      ? `${formatMoney(openMinor)} is waiting to be paid.`
      : "Nothing is waiting to be paid.";
  const detail =
    open.length === 0
      ? drafts.length > 0
        ? `${countLabel(drafts.length)} in draft, worth ${formatMoney(sum(drafts))}, not sent yet.`
        : "Draft an invoice to bill a client."
      : overdue.length > 0
        ? `${countLabel(open.length)} out. ${formatMoney(overdueMinor)} is past its due date.`
        : `${countLabel(open.length)} out, none past the due date.`;

  return (
    <section
      aria-labelledby="receivables-title"
      className="grid overflow-hidden rounded-lg border bg-card lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
    >
      <div className="flex flex-col px-5 py-5 sm:px-6 sm:py-6">
        <h2 id="receivables-title" className="text-muted-foreground">
          Open invoices
        </h2>
        <p className="mt-2 max-w-[18ch] font-display text-statement text-balance">{headline}</p>
        <p className="mt-2 text-muted-foreground">{detail}</p>

        {open.length > 0 ? (
          <div className="mt-5">
            <div className="flex h-2.5 gap-0.5" aria-hidden>
              {notDueMinor > 0 ? (
                <span className="rounded-sm bg-primary" style={{ flexGrow: notDueMinor }} />
              ) : null}
              {overdueMinor > 0 ? (
                <span className="rounded-sm bg-danger" style={{ flexGrow: overdueMinor }} />
              ) : null}
            </div>
            <dl className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-caption">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] bg-primary" aria-hidden />
                <dt className="text-muted-foreground">Not yet due</dt>
                <dd className="tabular font-medium">{formatMoney(notDueMinor)}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px] bg-danger" aria-hidden />
                <dt className="text-muted-foreground">Overdue</dt>
                <dd className="tabular font-medium">{formatMoney(overdueMinor)}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-6">
          <Button className="hover:bg-primary-hover" onClick={() => openQuickCreate("invoice")}>
            <Plus data-icon="inline-start" aria-hidden />
            New invoice
          </Button>
          <Link href="/money/invoices" className="font-medium text-primary hover:underline">
            View all invoices
          </Link>
        </div>
      </div>

      <div className="border-t bg-canvas/60 px-5 py-5 sm:px-6 lg:border-t-0 lg:border-l">
        {open.length === 0 ? (
          <p className="flex h-full min-h-24 items-center text-muted-foreground">
            Sent invoices appear here until they are paid.
          </p>
        ) : (
          <>
            <ul>
              {open.slice(0, VISIBLE_LINES).map((invoice) => {
                const late = invoiceDisplayStatus(invoice) === "overdue";
                return (
                  <li key={invoice.id} className="border-b border-dashed last:border-b-0">
                    <Link
                      href={`/money/invoices/${invoice.id}`}
                      className="group grid grid-cols-[1fr_auto] items-baseline gap-x-4 py-3 first:pt-0"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium group-hover:underline">
                          {client(invoice.contactId)}
                        </span>
                        <span className="tabular block truncate text-caption text-muted-foreground">
                          {invoice.number}, {invoice.description}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="tabular block font-display text-base font-semibold">
                          {formatMoney(invoice.amountMinor)}
                        </span>
                        <span
                          className={cn(
                            "tabular block text-caption",
                            late ? "font-medium text-danger" : "text-muted-foreground",
                          )}
                        >
                          {describeDue(invoice.dueOn, DEMO_TODAY).label}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {open.length > VISIBLE_LINES ? (
              <p className="pt-2 text-caption text-muted-foreground">
                And {open.length - VISIBLE_LINES} more.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
