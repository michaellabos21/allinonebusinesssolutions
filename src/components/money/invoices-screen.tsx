"use client";

import { BadgeCheck, Eye, Pencil, Plus, ReceiptText, SearchX, Send } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { type Column, DataTable, Pagination, useTableState } from "@/components/common/data-table";
import { PageHeader } from "@/components/common/page-header";
import { RowActions } from "@/components/common/row-actions";
import { EmptyState } from "@/components/common/states";
import { InvoiceStatusBadge } from "@/components/common/status-badge";
import { SearchInput, TableToolbar } from "@/components/common/table-toolbar";
import { PaymentDialog, useInvoiceActions } from "@/components/money/invoice-actions";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { DEMO_TODAY } from "@/config/app";
import { describeDue, formatDate, formatMoney } from "@/lib/format";
import { invoiceDisplayStatus } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { formatMonthName } from "@/lib/work";
import type { Invoice, InvoiceDisplayStatus } from "@/mocks";

type Tab = "all" | InvoiceDisplayStatus;
const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
];

type InvoiceRow = Invoice & { display: InvoiceDisplayStatus; client: string };

const sum = (rows: { amountMinor: number }[]) =>
  rows.reduce((total, row) => total + row.amountMinor, 0);
const countLabel = (count: number) => `${count} ${count === 1 ? "invoice" : "invoices"}`;

export function InvoicesScreen() {
  const { invoices, contactCompanyName, contacts } = useDemoStore();
  const actions = useInvoiceActions();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  const all = useMemo<InvoiceRow[]>(
    () =>
      invoices.map((invoice) => ({
        ...invoice,
        display: invoiceDisplayStatus(invoice),
        client:
          contactCompanyName(invoice.contactId) ||
          contacts.find((contact) => contact.id === invoice.contactId)?.name ||
          "Unknown client",
      })),
    [invoices, contacts, contactCompanyName],
  );

  const searched = useMemo(() => {
    const text = query.trim().toLowerCase();
    return text
      ? all.filter((row) =>
          [row.number, row.client, row.description].some((value) =>
            value.toLowerCase().includes(text),
          ),
        )
      : all;
  }, [all, query]);
  const rows = tab === "all" ? searched : searched.filter((row) => row.display === tab);

  const month = DEMO_TODAY.slice(0, 7);
  const unpaid = all.filter((row) => row.status === "sent");
  const overdue = all.filter((row) => row.display === "overdue");
  const paidThisMonth = all.filter((row) => row.paidOn?.startsWith(month));
  const drafts = all.filter((row) => row.status === "draft");
  const figures = [
    { label: "Awaiting payment", rows: unpaid, note: "Sent and not yet paid, including overdue." },
    { label: "Overdue", rows: overdue, note: "Past the due date.", alert: overdue.length > 0 },
    {
      label: "Paid this month",
      rows: paidThisMonth,
      note: `Payments recorded in ${formatMonthName(month)}.`,
    },
    { label: "Drafts", rows: drafts, note: "Not sent yet." },
  ];

  const columns = useMemo<Column<InvoiceRow>[]>(
    () => [
      {
        id: "number",
        header: "Invoice",
        sortValue: (row) => row.number,
        cell: (row) => (
          <div className="min-w-32">
            <Link
              href={`/money/invoices/${row.id}`}
              className="tabular font-medium hover:underline"
            >
              {row.number}
            </Link>
            <span className="block max-w-56 truncate text-caption text-muted-foreground">
              {row.description}
            </span>
          </div>
        ),
      },
      {
        id: "client",
        header: "Client",
        sortValue: (row) => row.client,
        className: "hidden sm:table-cell",
        cell: (row) => row.client,
      },
      {
        id: "issued",
        header: "Issued",
        sortValue: (row) => row.issuedOn,
        className: "hidden lg:table-cell",
        cell: (row) => (
          <span className="tabular whitespace-nowrap text-muted-foreground">
            {formatDate(row.issuedOn, "long")}
          </span>
        ),
      },
      {
        id: "due",
        header: "Due",
        sortValue: (row) => row.dueOn,
        className: "hidden md:table-cell",
        cell: (row) => (
          <span
            className={cn(
              "tabular whitespace-nowrap",
              row.display === "overdue" ? "font-medium text-danger" : "text-muted-foreground",
            )}
          >
            {row.display === "overdue"
              ? describeDue(row.dueOn, DEMO_TODAY).label
              : formatDate(row.dueOn, "long")}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        sortValue: (row) => TABS.findIndex((item) => item.value === row.display),
        cell: (row) => <InvoiceStatusBadge status={row.display} />,
      },
      {
        id: "amount",
        header: "Total",
        align: "right",
        sortValue: (row) => row.amountMinor,
        cell: (row) => <span className="whitespace-nowrap">{formatMoney(row.amountMinor)}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        hideHeader: true,
        align: "right",
        cell: (row) => (
          <RowActions
            label={`Actions for ${row.number}`}
            actions={[
              { label: "View", icon: Eye, href: `/money/invoices/${row.id}` },
              ...(row.status === "draft"
                ? [
                    { label: "Edit draft", icon: Pencil, href: `/money/invoices/${row.id}/edit` },
                    { label: "Mark as sent", icon: Send, onSelect: () => actions.markSent(row) },
                  ]
                : []),
              ...(row.status === "sent"
                ? [
                    {
                      label: "Record payment",
                      icon: BadgeCheck,
                      onSelect: () => actions.askPayment(row),
                    },
                  ]
                : []),
            ]}
          />
        ),
      },
    ],
    [actions],
  );

  const table = useTableState(rows, columns, {
    pageSize: 10,
    initialSort: { id: "number", direction: "desc" },
  });

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Invoices"
        description="Draft, send and track what clients owe. Sending and payments are simulated in this prototype."
        actions={
          <Button asChild className="hover:bg-primary-hover">
            <Link href="/money/invoices/new">
              <Plus data-icon="inline-start" aria-hidden />
              New invoice
            </Link>
          </Button>
        }
      />

      {invoices.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={ReceiptText}
            title="No invoices yet"
            description="Create your first invoice, or turn demo data on in the sidebar."
            action={
              <Button asChild variant="outline">
                <Link href="/money/invoices/new">New invoice</Link>
              </Button>
            }
            className="py-14"
          />
        </div>
      ) : (
        <>
          <section aria-label="Totals" className="overflow-hidden rounded-lg border bg-card">
            <dl className="grid grid-cols-2 lg:grid-cols-4">
              {figures.map((figure) => (
                <div key={figure.label} className="-mt-px -ml-px border-t border-l px-5 py-4">
                  <dt className="text-muted-foreground">{figure.label}</dt>
                  <dd className="mt-1">
                    <span className="block font-display text-figure">
                      {formatMoney(sum(figure.rows))}
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-caption",
                        figure.alert ? "font-medium text-danger" : "text-muted-foreground",
                      )}
                    >
                      {countLabel(figure.rows.length)}. {figure.note}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <TableToolbar>
            <div
              role="group"
              aria-label="Filter by status"
              className="flex max-w-full overflow-x-auto rounded-md border p-0.5"
            >
              {TABS.map((item) => {
                const count =
                  item.value === "all"
                    ? searched.length
                    : searched.filter((row) => row.display === item.value).length;
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={tab === item.value}
                    onClick={() => setTab(item.value)}
                    className={cn(
                      "flex h-7 shrink-0 items-center gap-1.5 rounded-sm px-2.5 font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                      tab === item.value && "bg-muted text-foreground",
                    )}
                  >
                    {item.label}
                    <span className="tabular text-xs font-normal text-muted-foreground">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <SearchInput
              value={query}
              onChange={setQuery}
              label="Search invoices"
              className="sm:ml-auto"
            />
          </TableToolbar>

          <section aria-label="Invoices" className="overflow-hidden rounded-lg border bg-card">
            {rows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No invoices match"
                description={
                  query
                    ? "Try a different search or another status tab."
                    : "There are no invoices with this status."
                }
                className="py-14"
              />
            ) : (
              <DataTable
                caption="Invoices"
                columns={columns}
                rows={table.pageRows}
                getRowId={(row) => row.id}
                sort={table.sort}
                onSort={table.toggleSort}
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-x-4 border-t px-5 py-2.5">
              <p className="text-caption text-muted-foreground">
                Showing {countLabel(rows.length)} worth{" "}
                <span className="tabular font-medium text-foreground">
                  {formatMoney(sum(rows))}
                </span>
                .
              </p>
            </div>
            <Pagination {...table.pagination} noun="invoices" />
          </section>
        </>
      )}

      <PaymentDialog {...actions.paymentDialog} />
    </div>
  );
}
