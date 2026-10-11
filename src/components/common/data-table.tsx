"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Makes the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: "right";
  /** Visually hides the header text (e.g. for an actions column). */
  hideHeader?: boolean;
  /** Extra classes for header and cells, e.g. `hidden md:table-cell`. */
  className?: string;
};

export type SortState = { id: string; direction: "asc" | "desc" };

/** Sorting and paging over rows that the caller has already filtered. */
export function useTableState<T>(
  rows: T[],
  columns: Column<T>[],
  { pageSize = 8, initialSort }: { pageSize?: number; initialSort?: SortState } = {},
) {
  const [sort, setSort] = useState<SortState | undefined>(initialSort);
  const [requestedPage, setPage] = useState(1);

  // A search or filter that changes the result count starts again from page 1.
  const [knownTotal, setKnownTotal] = useState(rows.length);
  if (knownTotal !== rows.length) {
    setKnownTotal(rows.length);
    setPage(1);
  }

  const sorted = useMemo(() => {
    const column = columns.find((item) => item.id === sort?.id);
    if (!sort || !column?.sortValue) return rows;
    const getValue = column.sortValue;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = getValue(a);
      const y = getValue(b);
      if (typeof x === "number" && typeof y === "number") return (x - y) * factor;
      return String(x).localeCompare(String(y), undefined, { sensitivity: "base" }) * factor;
    });
  }, [rows, columns, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  // Filtering can shrink the list under the current page; fall back to the last page.
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * pageSize;

  return {
    pageRows: sorted.slice(start, start + pageSize),
    sort,
    toggleSort: (id: string) => {
      setPage(1);
      setSort((current) =>
        current?.id === id
          ? { id, direction: current.direction === "asc" ? "desc" : "asc" }
          : { id, direction: "asc" },
      );
    },
    pagination: {
      page,
      pageCount,
      total: sorted.length,
      from: sorted.length === 0 ? 0 : start + 1,
      to: Math.min(start + pageSize, sorted.length),
      setPage,
    },
  };
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  sort,
  onSort,
  rowClassName,
}: {
  /** Read by screen readers; not shown. */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  sort?: SortState;
  onSort?: (id: string) => void;
  rowClassName?: (row: T) => string | undefined;
}) {
  return (
    // `relative` keeps visually hidden (absolutely positioned) labels inside the scroll area.
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b bg-muted/40">
            {columns.map((column) => {
              const active = sort?.id === column.id;
              const SortIcon = !active
                ? ChevronsUpDown
                : sort.direction === "asc"
                  ? ArrowUp
                  : ArrowDown;
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={
                    column.sortValue
                      ? active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className={cn(
                    "h-9 px-4 text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-5 last:pr-5",
                    column.align === "right" && "text-right",
                    column.className,
                  )}
                >
                  {column.hideHeader ? (
                    <span className="sr-only">{column.header}</span>
                  ) : column.sortValue && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.id)}
                      className={cn(
                        "-mx-1.5 inline-flex h-6 items-center gap-1 rounded-sm px-1.5 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                        active && "text-foreground",
                      )}
                    >
                      {column.header}
                      <SortIcon className="size-3" aria-hidden />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowId(row)}
              className={cn("border-b last:border-b-0 hover:bg-muted/40", rowClassName?.(row))}
            >
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    "px-4 py-2.5 align-middle first:pl-5 last:pr-5",
                    column.align === "right" && "tabular text-right",
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  from,
  to,
  setPage,
  noun,
}: ReturnType<typeof useTableState>["pagination"] & { noun: string }) {
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-2.5"
    >
      <p className="tabular text-caption text-muted-foreground" aria-live="polite">
        {total === 0 ? `No ${noun}` : `${from} to ${to} of ${total} ${noun}`}
      </p>
      <div className="flex items-center gap-2">
        <span className="tabular text-caption text-muted-foreground">
          Page {page} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
