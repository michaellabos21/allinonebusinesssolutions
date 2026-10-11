"use client";

import { Archive, ArchiveRestore, Package, Pencil, Plus, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { type Column, DataTable, Pagination, useTableState } from "@/components/common/data-table";
import { PageHeader } from "@/components/common/page-header";
import { RowActions } from "@/components/common/row-actions";
import { EmptyState } from "@/components/common/states";
import { Pill } from "@/components/common/status-badge";
import { FilterMenu, SearchInput, TableToolbar } from "@/components/common/table-toolbar";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import type { CatalogItem } from "@/mocks";

const TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "service", label: "Services" },
  { value: "product", label: "Products" },
  { value: "archived", label: "Archived" },
];

export function CatalogScreen() {
  const { catalog, openQuickCreate, openEditor, setCatalogItemArchived } = useDemoStore();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [archiveTarget, setArchiveTarget] = useState<CatalogItem | null>(null);

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return catalog.filter((item) => {
      if (type === "archived" ? !item.archived : item.archived) return false;
      if (type !== "all" && type !== "archived" && item.type !== type) return false;
      return !text || [item.name, item.description].some((value) => value.toLowerCase().includes(text));
    });
  }, [catalog, query, type]);

  const columns = useMemo<Column<CatalogItem>[]>(
    () => [
      {
        id: "name",
        header: "Item",
        sortValue: (item) => item.name,
        cell: (item) => (
          <div className="min-w-40">
            <span className="font-medium">{item.name}</span>
            <span className="block max-w-96 truncate text-caption text-muted-foreground">
              {item.description || "No description"}
            </span>
          </div>
        ),
      },
      {
        id: "type",
        header: "Type",
        sortValue: (item) => item.type,
        className: "hidden sm:table-cell",
        cell: (item) =>
          item.archived ? (
            <Pill tone="warning">Archived</Pill>
          ) : (
            <Pill tone={item.type === "service" ? "primary" : "neutral"}>
              {item.type === "service" ? "Service" : "Product"}
            </Pill>
          ),
      },
      {
        id: "price",
        header: "Unit price",
        align: "right",
        sortValue: (item) => item.unitPriceMinor,
        cell: (item) => (
          <span className="whitespace-nowrap">
            {formatMoney(item.unitPriceMinor)}
            <span className="text-muted-foreground"> per {item.unit}</span>
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        hideHeader: true,
        align: "right",
        cell: (item) => (
          <RowActions
            label={`Actions for ${item.name}`}
            actions={[
              { label: "Edit", icon: Pencil, onSelect: () => openEditor("catalog", item.id) },
              item.archived
                ? {
                    label: "Restore",
                    icon: ArchiveRestore,
                    onSelect: () => {
                      setCatalogItemArchived(item.id, false);
                      toast.success(`“${item.name}” restored`);
                    },
                  }
                : { label: "Archive", icon: Archive, destructive: true, onSelect: () => setArchiveTarget(item) },
            ]}
          />
        ),
      },
    ],
    [openEditor, setCatalogItemArchived],
  );

  const table = useTableState(rows, columns, { pageSize: 10, initialSort: { id: "name", direction: "asc" } });
  const hasFilters = query !== "" || type !== "all";

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Products & Services"
        description="What you sell and your usual rates. Pick these when adding lines to an invoice."
        actions={
          <Button className="hover:bg-primary-hover" onClick={() => openQuickCreate("catalog")}>
            <Plus data-icon="inline-start" aria-hidden />
            New item
          </Button>
        }
      />

      {catalog.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={Package}
            title="Your catalog is empty"
            description="Add the services and products you bill for, or turn demo data on in the sidebar."
            action={
              <Button variant="outline" onClick={() => openQuickCreate("catalog")}>
                New item
              </Button>
            }
            className="py-14"
          />
        </div>
      ) : (
        <>
          <TableToolbar>
            <SearchInput value={query} onChange={setQuery} label="Search the catalog" />
            <FilterMenu label="Show" options={TYPE_OPTIONS} value={type} onChange={setType} />
            {hasFilters ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setType("all");
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </TableToolbar>

          <section aria-label="Catalog" className="overflow-hidden rounded-lg border bg-card">
            {rows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No items match"
                description="Try a different search, or clear the filters to see the whole catalog."
                className="py-14"
              />
            ) : (
              <DataTable
                caption="Products and services"
                columns={columns}
                rows={table.pageRows}
                getRowId={(item) => item.id}
                sort={table.sort}
                onSort={table.toggleSort}
              />
            )}
            <Pagination {...table.pagination} noun="items" />
          </section>
        </>
      )}

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={`Archive “${archiveTarget?.name ?? "item"}”?`}
        description="It will no longer be offered when adding invoice lines. Invoices that already use it are not changed, and you can restore it from the Archived filter."
        confirmLabel="Archive item"
        onConfirm={() => {
          if (!archiveTarget) return;
          setCatalogItemArchived(archiveTarget.id, true);
          toast.success(`“${archiveTarget.name}” archived`, {
            action: { label: "Undo", onClick: () => setCatalogItemArchived(archiveTarget.id, false) },
          });
          setArchiveTarget(null);
        }}
      />
    </div>
  );
}
