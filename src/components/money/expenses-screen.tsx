"use client";

import {
  Archive,
  ArchiveRestore,
  Eye,
  Paperclip,
  Pencil,
  Plus,
  SearchX,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { type Column, DataTable, Pagination, useTableState } from "@/components/common/data-table";
import { PageHeader } from "@/components/common/page-header";
import { Panel } from "@/components/common/panel";
import { RowActions } from "@/components/common/row-actions";
import { EmptyState } from "@/components/common/states";
import { Pill } from "@/components/common/status-badge";
import { FilterMenu, SearchInput, TableToolbar } from "@/components/common/table-toolbar";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { ReceiptDialog, openReceipt } from "@/components/money/receipt-dialog";
import { PAYMENT_METHOD_LABEL } from "@/components/money/invoice-actions";
import { formatDate, formatMoney } from "@/lib/format";
import { runAction } from "@/lib/run-action";
import { getToday } from "@/lib/runtime";
import { formatMonth, shiftMonth } from "@/lib/work";
import { EXPENSE_CATEGORIES, type Expense } from "@/mocks";
import { setExpenseArchivedAction } from "@/server/actions/finance";

const sum = (rows: Expense[]) => rows.reduce((total, row) => total + row.amountMinor, 0);
const setArchived = (id: string, archived: boolean) =>
  runAction(setExpenseArchivedAction({ id, archived }));

export function ExpensesScreen() {
  const { expenses: allExpenses, projects, openQuickCreate, openEditor } = useDemoStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [period, setPeriod] = useState("all");
  const [showArchived, setShowArchived] = useState("live");
  const [archiveTarget, setArchiveTarget] = useState<Expense | null>(null);

  // The expense whose receipt is being attached lives in the address, so the
  // "Attach a receipt" link after saving an expense opens it here.
  const receiptTarget = allExpenses.find((item) => item.id === searchParams.get("receipt"));
  const setReceiptTarget = (id: string | null) =>
    router.replace(id ? `${pathname}?receipt=${id}` : pathname, { scroll: false });

  const live = allExpenses.filter((expense) => !expense.archived);
  const expenses = showArchived === "archived" ? allExpenses.filter((e) => e.archived) : live;
  const thisMonth = getToday().slice(0, 7);
  const lastMonth = shiftMonth(thisMonth, -1);
  const periodOptions = [
    { value: "all", label: "All time" },
    { value: thisMonth, label: formatMonth(thisMonth) },
    { value: lastMonth, label: formatMonth(lastMonth) },
  ];
  const categoryOptions = [
    { value: "all", label: "All" },
    ...[...new Set([...EXPENSE_CATEGORIES, ...allExpenses.map((expense) => expense.category)])].map(
      (name) => ({
        value: name,
        label: name,
      }),
    ),
  ];

  const projectName = useMemo(() => {
    const names = new Map(projects.map((project) => [project.id, project.name]));
    return (id: string | null) => (id ? (names.get(id) ?? "") : "");
  }, [projects]);

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (category !== "all" && expense.category !== category) return false;
      if (period !== "all" && !expense.date.startsWith(period)) return false;
      return (
        !text ||
        [expense.vendor, expense.description, projectName(expense.projectId)].some((value) =>
          value.toLowerCase().includes(text),
        )
      );
    });
  }, [expenses, projectName, query, category, period]);

  /** Spend by category for the rows on screen, largest first. */
  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of rows)
      totals.set(row.category, (totals.get(row.category) ?? 0) + row.amountMinor);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const largest = byCategory[0]?.[1] ?? 1;

  const columns = useMemo<Column<Expense>[]>(
    () => [
      {
        id: "date",
        header: "Date",
        sortValue: (expense) => expense.date,
        cell: (expense) => (
          <span className="tabular whitespace-nowrap text-muted-foreground">
            {formatDate(expense.date)}
          </span>
        ),
      },
      {
        id: "vendor",
        header: "Paid to",
        sortValue: (expense) => expense.vendor,
        cell: (expense) => (
          <div className="min-w-36">
            <span className="font-medium">{expense.vendor}</span>
            {expense.receiptPath ? (
              <Paperclip
                className="ml-1.5 inline size-3.5 text-muted-foreground"
                aria-label="Receipt attached"
              />
            ) : null}
            <span className="block max-w-72 truncate text-caption text-muted-foreground">
              {expense.description}
            </span>
          </div>
        ),
      },
      {
        id: "category",
        header: "Category",
        sortValue: (expense) => expense.category,
        className: "hidden sm:table-cell",
        cell: (expense) => <Pill>{expense.category}</Pill>,
      },
      {
        id: "project",
        header: "Project",
        sortValue: (expense) => projectName(expense.projectId),
        className: "hidden lg:table-cell",
        cell: (expense) =>
          expense.projectId ? (
            <Link href={`/work/projects/${expense.projectId}`} className="hover:underline">
              {projectName(expense.projectId)}
            </Link>
          ) : (
            <span className="text-muted-foreground">None</span>
          ),
      },
      {
        id: "amount",
        header: "Amount",
        align: "right",
        sortValue: (expense) => expense.amountMinor,
        cell: (expense) => (
          <span className="whitespace-nowrap">
            {formatMoney(expense.amountMinor, { currency: expense.currency })}
            <span className="block text-caption text-muted-foreground">
              {PAYMENT_METHOD_LABEL[expense.paymentMethod]}
            </span>
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        hideHeader: true,
        align: "right",
        cell: (expense) => (
          <RowActions
            label={`Actions for the ${expense.vendor} expense`}
            actions={[
              ...(expense.receiptPath
                ? [{ label: "View receipt", icon: Eye, onSelect: () => openReceipt(expense.id) }]
                : []),
              {
                label: expense.receiptPath ? "Replace receipt" : "Attach receipt",
                icon: Paperclip,
                onSelect: () =>
                  router.replace(`${pathname}?receipt=${expense.id}`, { scroll: false }),
              },
              { label: "Edit", icon: Pencil, onSelect: () => openEditor("expense", expense.id) },
              expense.archived
                ? {
                    label: "Restore",
                    icon: ArchiveRestore,
                    onSelect: async () => {
                      if (await setArchived(expense.id, false))
                        toast.success(`Expense from ${expense.vendor} restored`);
                    },
                  }
                : {
                    label: "Archive",
                    icon: Archive,
                    destructive: true,
                    onSelect: () => setArchiveTarget(expense),
                  },
            ]}
          />
        ),
      },
    ],
    [projectName, openEditor, router, pathname],
  );

  const table = useTableState(rows, columns, {
    pageSize: 10,
    initialSort: { id: "date", direction: "desc" },
  });
  const hasFilters =
    query !== "" || category !== "all" || period !== "all" || showArchived !== "live";
  const monthRows = live.filter((expense) => expense.date.startsWith(thisMonth));
  const lastMonthRows = live.filter((expense) => expense.date.startsWith(lastMonth));

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Expenses"
        description={
          live.length > 0
            ? `${formatMoney(sum(monthRows))} spent so far in ${formatMonth(thisMonth)}. ${formatMonth(lastMonth)} came to ${formatMoney(sum(lastMonthRows))}.`
            : "Record what the business pays for."
        }
        actions={
          <Button className="hover:bg-primary-hover" onClick={() => openQuickCreate("expense")}>
            <Plus data-icon="inline-start" aria-hidden />
            New expense
          </Button>
        }
      />

      {allExpenses.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={Wallet}
            title="No expenses yet"
            description="Record what the business pays for, and attach the receipt so it’s easy to find later."
            action={
              <Button variant="outline" onClick={() => openQuickCreate("expense")}>
                New expense
              </Button>
            }
            className="py-14"
          />
        </div>
      ) : (
        <>
          <TableToolbar>
            <SearchInput value={query} onChange={setQuery} label="Search expenses" />
            <FilterMenu
              label="Period"
              options={periodOptions}
              value={period}
              onChange={setPeriod}
            />
            <FilterMenu
              label="Category"
              options={categoryOptions}
              value={category}
              onChange={setCategory}
            />
            <FilterMenu
              label="Show"
              options={[
                { value: "live", label: "Current" },
                { value: "archived", label: "Archived" },
              ]}
              value={showArchived}
              onChange={setShowArchived}
            />
            {hasFilters ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                  setPeriod("all");
                  setShowArchived("live");
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </TableToolbar>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section aria-label="Expenses" className="overflow-hidden rounded-lg border bg-card">
              {rows.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No expenses match"
                  description="Try a different search, period or category."
                  className="py-14"
                />
              ) : (
                <DataTable
                  caption="Expenses"
                  columns={columns}
                  rows={table.pageRows}
                  getRowId={(expense) => expense.id}
                  sort={table.sort}
                  onSort={table.toggleSort}
                />
              )}
              <Pagination {...table.pagination} noun="expenses" />
            </section>

            <Panel
              title="By category"
              description={`${formatMoney(sum(rows))} across the ${rows.length} ${rows.length === 1 ? "expense" : "expenses"} shown.`}
              className="self-start"
            >
              {byCategory.length === 0 ? (
                <p className="text-muted-foreground">Nothing to total.</p>
              ) : (
                <ul className="space-y-3 pt-1">
                  {byCategory.map(([name, totalMinor]) => (
                    <li key={name}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span>{name}</span>
                        <span className="tabular">{formatMoney(totalMinor)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-sm bg-muted" aria-hidden>
                        <div
                          className="h-full rounded-sm bg-[var(--chart-1)]"
                          style={{ width: `${Math.max((totalMinor / largest) * 100, 1.5)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title="Archive this expense?"
        description={
          archiveTarget
            ? `${formatMoney(archiveTarget.amountMinor)} to ${archiveTarget.vendor} on ${formatDate(archiveTarget.date, "long")} leaves your totals and reports. It is kept, with its receipt, under Show: Archived.`
            : ""
        }
        confirmLabel="Archive expense"
        onConfirm={async () => {
          if (!archiveTarget) return;
          const { id, vendor } = archiveTarget;
          if (!(await setArchived(id, true))) return;
          toast.success(`Expense from ${vendor} archived`, {
            action: { label: "Undo", onClick: () => setArchived(id, false) },
          });
          setArchiveTarget(null);
        }}
      />
      {receiptTarget ? (
        <ReceiptDialog
          key={receiptTarget.id}
          expense={receiptTarget}
          onClose={() => setReceiptTarget(null)}
        />
      ) : null}
    </div>
  );
}
