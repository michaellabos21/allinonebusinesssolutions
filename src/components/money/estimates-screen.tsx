"use client";

import { Check, Eye, FileText, Pencil, Plus, ReceiptText, SearchX, Send, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { type Column, DataTable, Pagination, useTableState } from "@/components/common/data-table";
import { PageHeader } from "@/components/common/page-header";
import { RowActions } from "@/components/common/row-actions";
import { EmptyState } from "@/components/common/states";
import { EstimateStatusBadge } from "@/components/common/status-badge";
import { SearchInput, TableToolbar } from "@/components/common/table-toolbar";
import { EstimateActionDialogs, useEstimateActions } from "@/components/money/estimate-actions";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { estimateDisplayStatus } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type { Estimate, EstimateDisplayStatus } from "@/mocks";

type Tab = "all" | EstimateDisplayStatus;
const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "expired", label: "Expired" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
];

type EstimateRow = Estimate & { display: EstimateDisplayStatus; client: string };

export function EstimatesScreen() {
  const { estimates, contactCompanyName, contactName } = useDemoStore();
  const actions = useEstimateActions();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  const all = useMemo<EstimateRow[]>(
    () =>
      estimates.map((estimate) => ({
        ...estimate,
        display: estimateDisplayStatus(estimate),
        client:
          contactCompanyName(estimate.contactId) ||
          contactName(estimate.contactId) ||
          "No client yet",
      })),
    [estimates, contactName, contactCompanyName],
  );
  const searched = useMemo(() => {
    const text = query.trim().toLowerCase();
    return text
      ? all.filter((row) =>
          [row.number ?? "draft", row.client].some((value) => value.toLowerCase().includes(text)),
        )
      : all;
  }, [all, query]);
  const rows = tab === "all" ? searched : searched.filter((row) => row.display === tab);

  const columns = useMemo<Column<EstimateRow>[]>(
    () => [
      {
        id: "number",
        header: "Estimate",
        sortValue: (row) => row.number ?? "",
        cell: (row) => (
          <Link href={`/money/estimates/${row.id}`} className="tabular font-medium hover:underline">
            {row.number ?? "Draft"}
          </Link>
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
        id: "valid",
        header: "Valid until",
        sortValue: (row) => row.validUntil,
        className: "hidden md:table-cell",
        cell: (row) => (
          <span className="tabular whitespace-nowrap text-muted-foreground">
            {formatDate(row.validUntil, "long")}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        sortValue: (row) => TABS.findIndex((item) => item.value === row.display),
        cell: (row) => <EstimateStatusBadge status={row.display} />,
      },
      {
        id: "amount",
        header: "Total",
        align: "right",
        sortValue: (row) => row.amountMinor,
        cell: (row) => (
          <span className="whitespace-nowrap">
            {formatMoney(row.amountMinor, { currency: row.currency })}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        hideHeader: true,
        align: "right",
        cell: (row) => (
          <RowActions
            label={`Actions for ${row.number ?? "draft estimate"}`}
            actions={[
              { label: "View", icon: Eye, href: `/money/estimates/${row.id}` },
              ...(row.status === "draft"
                ? [
                    { label: "Edit draft", icon: Pencil, href: `/money/estimates/${row.id}/edit` },
                    { label: "Mark as sent", icon: Send, onSelect: () => actions.askSend(row) },
                  ]
                : []),
              ...(row.status === "sent"
                ? [
                    { label: "Mark accepted", icon: Check, onSelect: () => actions.askAccept(row) },
                    { label: "Mark declined", icon: X, onSelect: () => actions.askDecline(row) },
                  ]
                : []),
              ...(row.status === "accepted"
                ? [
                    row.convertedInvoiceId
                      ? {
                          label: "View invoice",
                          icon: ReceiptText,
                          href: `/money/invoices/${row.convertedInvoiceId}`,
                        }
                      : {
                          label: "Create invoice",
                          icon: ReceiptText,
                          onSelect: () => actions.askConvert(row),
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
    initialSort: { id: "issued", direction: "desc" },
  });

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Estimates"
        description="Quote a price before the work. When a client accepts, turn the estimate into an invoice."
        actions={
          <Button asChild className="hover:bg-primary-hover">
            <Link href="/money/estimates/new">
              <Plus data-icon="inline-start" aria-hidden />
              New estimate
            </Link>
          </Button>
        }
      />

      {estimates.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={FileText}
            title="No estimates yet"
            description="Write an estimate to quote a client, then turn it into an invoice once they accept."
            action={
              <Button asChild variant="outline">
                <Link href="/money/estimates/new">New estimate</Link>
              </Button>
            }
            className="py-14"
          />
        </div>
      ) : (
        <>
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
              label="Search estimates"
              className="sm:ml-auto"
            />
          </TableToolbar>

          <section aria-label="Estimates" className="overflow-hidden rounded-lg border bg-card">
            {rows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No estimates match"
                description={
                  query
                    ? "Try a different search or another status tab."
                    : "There are no estimates with this status."
                }
                className="py-14"
              />
            ) : (
              <DataTable
                caption="Estimates"
                columns={columns}
                rows={table.pageRows}
                getRowId={(row) => row.id}
                sort={table.sort}
                onSort={table.toggleSort}
              />
            )}
            <Pagination {...table.pagination} noun="estimates" />
          </section>
        </>
      )}

      <EstimateActionDialogs {...actions.dialogs} />
    </div>
  );
}
