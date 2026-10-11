"use client";

import { Pencil, Plus, SearchX, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
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
import { DEMO_TODAY } from "@/config/app";
import { formatDate, formatMoney } from "@/lib/format";
import { formatMonth, shiftMonth } from "@/lib/work";
import { EXPENSE_CATEGORIES, type Expense } from "@/mocks";

const sum = (rows: Expense[]) => rows.reduce((total, row) => total + row.amountMinor, 0);

export function ExpensesScreen() {
  const { expenses, projects, openQuickCreate, openEditor, removeExpense, saveExpense } =
    useDemoStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [period, setPeriod] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const thisMonth = DEMO_TODAY.slice(0, 7);
  const lastMonth = shiftMonth(thisMonth, -1);
  const periodOptions = [
    { value: "all", label: "All time" },
    { value: thisMonth, label: formatMonth(thisMonth) },
    { value: lastMonth, label: formatMonth(lastMonth) },
  ];
  const categoryOptions = [
    { value: "all", label: "All" },
    ...[...new Set([...EXPENSE_CATEGORIES, ...expenses.map((expense) => expense.category)])].map(
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
          <span className="whitespace-nowrap">{formatMoney(expense.amountMinor)}</span>
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
              { label: "Edit", icon: Pencil, onSelect: () => openEditor("expense", expense.id) },
              {
                label: "Delete",
                icon: Trash2,
                destructive: true,
                onSelect: () => setDeleteTarget(expense),
              },
            ]}
          />
        ),
      },
    ],
    [projectName, openEditor],
  );

  const table = useTableState(rows, columns, {
    pageSize: 10,
    initialSort: { id: "date", direction: "desc" },
  });
  const hasFilters = query !== "" || category !== "all" || period !== "all";
  const monthRows = expenses.filter((expense) => expense.date.startsWith(thisMonth));
  const lastMonthRows = expenses.filter((expense) => expense.date.startsWith(lastMonth));

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Expenses"
        description={
          expenses.length > 0
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

      {expenses.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={Wallet}
            title="No expenses yet"
            description="Record your first expense, or turn demo data on in the sidebar."
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
            {hasFilters ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                  setPeriod("all");
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
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this expense?"
        description={
          deleteTarget
            ? `${formatMoney(deleteTarget.amountMinor)} to ${deleteTarget.vendor} on ${formatDate(deleteTarget.date, "long")} will be removed from your totals.`
            : ""
        }
        confirmLabel="Delete expense"
        onConfirm={() => {
          if (!deleteTarget) return;
          const { vendor, date, amountMinor, category, description, projectId } = deleteTarget;
          const fields = { vendor, date, amountMinor, category, description, projectId };
          removeExpense(deleteTarget.id);
          toast.success(`Expense from ${deleteTarget.vendor} deleted`, {
            action: { label: "Undo", onClick: () => saveExpense(fields) },
          });
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
