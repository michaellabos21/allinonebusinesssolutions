"use client";

import { Archive, ArchiveRestore, Building2, Eye, Pencil, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { type Column, DataTable, Pagination, useTableState } from "@/components/common/data-table";
import { PageHeader } from "@/components/common/page-header";
import { RowActions } from "@/components/common/row-actions";
import { EmptyState } from "@/components/common/states";
import { CompanyTypeBadge } from "@/components/common/status-badge";
import { FilterMenu, SearchInput, TableToolbar } from "@/components/common/table-toolbar";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { getCompanyRollup } from "@/lib/crm";
import { formatMoney } from "@/lib/format";
import type { Company } from "@/mocks";

const TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "client", label: "Clients" },
  { value: "prospect", label: "Prospects" },
  { value: "archived", label: "Archived" },
];

type CompanyRow = Company & { peopleCount: number; openDealMinor: number; billedMinor: number };

export function CompaniesScreen() {
  const { companies, contacts, deals, invoices, openQuickCreate, openEditor, setCompanyArchived } = useDemoStore();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [archiveTarget, setArchiveTarget] = useState<Company | null>(null);

  const rows = useMemo<CompanyRow[]>(() => {
    const text = query.trim().toLowerCase();
    return companies
      .filter((company) => {
        if (type === "archived" ? !company.archived : company.archived) return false;
        if (type !== "all" && type !== "archived" && company.type !== type) return false;
        if (!text) return true;
        return [company.name, company.industry, company.city].some((value) => value.toLowerCase().includes(text));
      })
      .map((company) => {
        const rollup = getCompanyRollup(company, { contacts, deals, invoices });
        return {
          ...company,
          peopleCount: rollup.people.length,
          openDealMinor: rollup.openDealMinor,
          billedMinor: rollup.billedMinor,
        };
      });
  }, [companies, contacts, deals, invoices, query, type]);

  const columns = useMemo<Column<CompanyRow>[]>(
    () => [
      {
        id: "name",
        header: "Company",
        sortValue: (company) => company.name,
        cell: (company) => (
          <div className="min-w-0">
            <Link href={`/crm/companies/${company.id}`} className="block truncate font-medium hover:underline">
              {company.name}
            </Link>
            <span className="block truncate text-caption text-muted-foreground">
              {[company.industry, company.city].filter(Boolean).join(", ") || "No details yet"}
            </span>
          </div>
        ),
      },
      {
        id: "type",
        header: "Relationship",
        sortValue: (company) => company.type,
        cell: (company) => <CompanyTypeBadge type={company.type} archived={company.archived} />,
      },
      {
        id: "people",
        header: "Contacts",
        align: "right",
        sortValue: (company) => company.peopleCount,
        className: "hidden sm:table-cell",
        cell: (company) => company.peopleCount,
      },
      {
        id: "deals",
        header: "Open deals",
        align: "right",
        sortValue: (company) => company.openDealMinor,
        className: "hidden md:table-cell",
        cell: (company) =>
          company.openDealMinor > 0 ? formatMoney(company.openDealMinor) : <span className="text-muted-foreground">None</span>,
      },
      {
        id: "billed",
        header: "Invoiced",
        align: "right",
        sortValue: (company) => company.billedMinor,
        className: "hidden lg:table-cell",
        cell: (company) =>
          company.billedMinor > 0 ? formatMoney(company.billedMinor) : <span className="text-muted-foreground">None</span>,
      },
      {
        id: "actions",
        header: "Actions",
        hideHeader: true,
        align: "right",
        cell: (company) => (
          <RowActions
            label={`Actions for ${company.name}`}
            actions={[
              { label: "View", icon: Eye, href: `/crm/companies/${company.id}` },
              { label: "Edit", icon: Pencil, onSelect: () => openEditor("company", company.id) },
              company.archived
                ? {
                    label: "Restore",
                    icon: ArchiveRestore,
                    onSelect: () => {
                      setCompanyArchived(company.id, false);
                      toast.success(`${company.name} restored`);
                    },
                  }
                : { label: "Archive", icon: Archive, destructive: true, onSelect: () => setArchiveTarget(company) },
            ]}
          />
        ),
      },
    ],
    [openEditor, setCompanyArchived],
  );

  const table = useTableState(rows, columns, { initialSort: { id: "name", direction: "asc" } });
  const hasFilters = query !== "" || type !== "all";

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Companies"
        description="Client organisations and prospects, with their people, deals and billing."
        actions={
          <Button className="hover:bg-primary-hover" onClick={() => openQuickCreate("company")}>
            <Plus data-icon="inline-start" aria-hidden />
            New company
          </Button>
        }
      />

      {companies.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={Building2}
            title="No companies yet"
            description="Add a company, or add a contact with a company name and it is created for you."
            action={
              <Button variant="outline" onClick={() => openQuickCreate("company")}>
                New company
              </Button>
            }
            className="py-14"
          />
        </div>
      ) : (
        <>
          <TableToolbar>
            <SearchInput value={query} onChange={setQuery} label="Search companies" />
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

          <section aria-label="Companies" className="overflow-hidden rounded-lg border bg-card">
            {rows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No companies match"
                description="Try a different search, or clear the filters to see every company."
                className="py-14"
              />
            ) : (
              <DataTable
                caption="Companies"
                columns={columns}
                rows={table.pageRows}
                getRowId={(company) => company.id}
                sort={table.sort}
                onSort={table.toggleSort}
              />
            )}
            <Pagination {...table.pagination} noun="companies" />
          </section>
        </>
      )}

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={`Archive ${archiveTarget?.name ?? "company"}?`}
        description="The company moves out of your lists and pickers. Its contacts, deals and invoices are kept, and you can restore it from the Archived filter."
        confirmLabel="Archive company"
        onConfirm={() => {
          if (!archiveTarget) return;
          setCompanyArchived(archiveTarget.id, true);
          toast.success(`${archiveTarget.name} archived`, {
            action: { label: "Undo", onClick: () => setCompanyArchived(archiveTarget.id, false) },
          });
          setArchiveTarget(null);
        }}
      />
    </div>
  );
}
