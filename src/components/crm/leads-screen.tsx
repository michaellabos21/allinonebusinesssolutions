"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowRightCircle,
  Download,
  FileText,
  Inbox,
  Pencil,
  Plus,
  SearchX,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { type Column, DataTable, Pagination, useTableState } from "@/components/common/data-table";
import { PageHeader } from "@/components/common/page-header";
import { RowActions } from "@/components/common/row-actions";
import { EmptyState } from "@/components/common/states";
import { LEAD_STATUS_LABEL, LeadStatusBadge } from "@/components/common/status-badge";
import { FilterMenu, SearchInput, TableToolbar } from "@/components/common/table-toolbar";
import { ConvertLeadDialog } from "@/components/crm/convert-lead-dialog";
import { EnquiryDialog, attributionSummary } from "@/components/crm/enquiry-dialog";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv-export";
import { formatDate } from "@/lib/format";
import { deleteLead, setLeadArchived } from "@/lib/record-actions";
import { getToday, memberName } from "@/lib/runtime";
import type { Lead } from "@/mocks";
import { can } from "@/server/permissions";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "disqualified", label: "Disqualified" },
  { value: "converted", label: "Converted" },
  { value: "archived", label: "Archived" },
];

/** Leads still being worked: not converted, disqualified or archived. */
const isOpen = (lead: Lead) =>
  !lead.archived && lead.status !== "converted" && lead.status !== "disqualified";

export function LeadsScreen() {
  const store = useDemoStore();
  const { leads, leadForms, openQuickCreate, openEditor } = store;
  const canArchive = can(store.account.workspace.role, "records.archive");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("open");
  const [owner, setOwner] = useState("all");
  const [source, setSource] = useState("all");
  // "View leads" on a lead form opens this screen filtered to that form.
  const searchParams = useSearchParams();
  const [form, setForm] = useState(() => searchParams.get("form") ?? "all");
  const [enquiryTarget, setEnquiryTarget] = useState<Lead | null>(null);
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  const ownerOptions = [
    { value: "all", label: "Anyone" },
    { value: "none", label: "Unassigned" },
    ...store.team.map((member) => ({ value: member.id, label: member.name })),
  ];
  const sourceOptions = [
    { value: "all", label: "Any source" },
    ...[...new Set(leads.map((lead) => lead.source).filter(Boolean))]
      .sort()
      .map((value) => ({ value, label: value })),
  ];
  const formName = new Map(leadForms.map((item) => [item.id, item.name]));
  for (const lead of leads) {
    if (lead.formId && !formName.has(lead.formId)) {
      formName.set(lead.formId, lead.source.replace(/^Form: /, ""));
    }
  }
  const formOptions = [
    { value: "all", label: "Any form" },
    { value: "none", label: "Added by hand" },
    ...[...formName].map(([value, label]) => ({ value, label })),
  ];

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (status === "archived" ? !lead.archived : lead.archived) return false;
      if (status === "open" && !isOpen(lead)) return false;
      if (!["open", "archived"].includes(status) && lead.status !== status) return false;
      if (owner === "none" ? lead.ownerId !== null : owner !== "all" && lead.ownerId !== owner) {
        return false;
      }
      if (source !== "all" && lead.source !== source) return false;
      if (form === "none" ? lead.formId !== null : form !== "all" && lead.formId !== form) {
        return false;
      }
      if (!text) return true;
      return [lead.name, lead.email, lead.companyName].some((value) =>
        value.toLowerCase().includes(text),
      );
    });
  }, [leads, query, status, owner, source, form]);

  const columns = useMemo<Column<Lead>[]>(
    () => [
      {
        id: "name",
        header: "Lead",
        sortValue: (lead) => lead.name,
        cell: (lead) => (
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => openEditor("lead", lead.id)}
              disabled={lead.status === "converted"}
              className="block max-w-full truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:no-underline"
            >
              {lead.name}
            </button>
            <span className="block truncate text-caption text-muted-foreground">
              {[lead.email, lead.companyName].filter(Boolean).join(" · ") || "No details"}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        sortValue: (lead) => lead.status,
        cell: (lead) => <LeadStatusBadge status={lead.status} archived={lead.archived} />,
      },
      {
        id: "source",
        header: "Source",
        sortValue: (lead) => lead.source,
        className: "hidden md:table-cell",
        cell: (lead) => {
          const via = attributionSummary(lead.attribution);
          return (
            <div className="min-w-0">
              <span className="block truncate">
                {lead.source || <span className="text-muted-foreground">Unknown</span>}
              </span>
              {via ? (
                <span className="block truncate text-caption text-muted-foreground">{via}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "owner",
        header: "Owner",
        sortValue: (lead) => (lead.ownerId ? memberName(lead.ownerId) : ""),
        className: "hidden lg:table-cell",
        cell: (lead) =>
          lead.ownerId ? (
            memberName(lead.ownerId)
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          ),
      },
      {
        id: "added",
        header: "Added",
        sortValue: (lead) => lead.createdOn,
        className: "hidden sm:table-cell",
        cell: (lead) => (
          <span className="tabular whitespace-nowrap text-muted-foreground">
            {formatDate(lead.createdOn, "long")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        hideHeader: true,
        align: "right",
        cell: (lead) =>
          lead.status === "converted" ? (
            <span className="flex justify-end gap-3 text-caption whitespace-nowrap">
              {lead.convertedContactId ? (
                <Link
                  href={`/crm/contacts/${lead.convertedContactId}`}
                  className="text-primary hover:underline"
                >
                  Contact
                </Link>
              ) : null}
              {lead.convertedDealId ? (
                <Link
                  href={`/crm/deals?deal=${lead.convertedDealId}`}
                  className="text-primary hover:underline"
                >
                  Deal
                </Link>
              ) : null}
            </span>
          ) : (
            <div className="flex items-center justify-end gap-1">
              {!lead.archived ? (
                <Button variant="outline" size="sm" onClick={() => setConvertTarget(lead)}>
                  <ArrowRightCircle data-icon="inline-start" aria-hidden />
                  Convert
                  <span className="sr-only"> {lead.name}</span>
                </Button>
              ) : null}
              <RowActions
                label={`Actions for ${lead.name}`}
                actions={[
                  ...(lead.formId
                    ? [
                        {
                          label: "View enquiry",
                          icon: FileText,
                          onSelect: () => setEnquiryTarget(lead),
                        },
                      ]
                    : []),
                  { label: "Edit", icon: Pencil, onSelect: () => openEditor("lead", lead.id) },
                  ...(canArchive
                    ? [
                        lead.archived
                          ? {
                              label: "Restore",
                              icon: ArchiveRestore,
                              onSelect: async () => {
                                if (await setLeadArchived(lead.id, false)) {
                                  toast.success(`${lead.name} restored`);
                                }
                              },
                            }
                          : {
                              label: "Archive",
                              icon: Archive,
                              destructive: true,
                              onSelect: () => setArchiveTarget(lead),
                            },
                        {
                          label: "Delete",
                          icon: Trash2,
                          destructive: true,
                          onSelect: () => setDeleteTarget(lead),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          ),
      },
    ],
    [openEditor, canArchive],
  );

  const table = useTableState(filtered, columns, {
    initialSort: { id: "added", direction: "desc" },
  });
  const hasFilters =
    query !== "" || status !== "open" || owner !== "all" || source !== "all" || form !== "all";
  const openCount = leads.filter(isOpen).length;
  const unassigned = leads.filter((lead) => isOpen(lead) && lead.ownerId === null).length;

  function exportCsv() {
    downloadCsv(
      `leads-${getToday()}.csv`,
      toCsv(
        [
          "Name",
          "Email",
          "Phone",
          "Company",
          "Source",
          "Status",
          "Owner",
          "Added",
          "Notes",
          "Form answers",
          "UTM source",
          "UTM medium",
          "UTM campaign",
          "Referrer",
          "Form page",
        ],
        filtered.map((lead) => [
          lead.name,
          lead.email,
          lead.phone,
          lead.companyName,
          lead.source,
          LEAD_STATUS_LABEL[lead.status],
          lead.ownerId ? memberName(lead.ownerId) : "",
          lead.createdOn,
          lead.notes,
          lead.answers.map((answer) => `${answer.label}: ${answer.value}`).join("\n"),
          lead.attribution.utm_source ?? "",
          lead.attribution.utm_medium ?? "",
          lead.attribution.utm_campaign ?? "",
          lead.attribution.referrer ?? "",
          lead.attribution.page_url ?? "",
        ]),
      ),
    );
  }

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Leads"
        description={
          openCount > 0
            ? `${openCount} open ${openCount === 1 ? "lead" : "leads"}${unassigned ? `, ${unassigned} unassigned` : ""}.`
            : "Enquiries to qualify, then convert into contacts and deals."
        }
        actions={
          <>
            {leads.length > 0 ? (
              <Button variant="outline" onClick={exportCsv}>
                <Download data-icon="inline-start" aria-hidden />
                Export CSV
              </Button>
            ) : null}
            <Button className="hover:bg-primary-hover" onClick={() => openQuickCreate("lead")}>
              <Plus data-icon="inline-start" aria-hidden />
              New lead
            </Button>
          </>
        }
      />

      {leads.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={Inbox}
            title="No leads yet"
            description={
              leadForms.length > 0
                ? "Add one yourself, or share a lead form so enquiries arrive here."
                : "Add one yourself, or create a lead form under Lead forms so enquiries arrive here."
            }
            action={
              <Button variant="outline" onClick={() => openQuickCreate("lead")}>
                New lead
              </Button>
            }
            className="py-14"
          />
        </div>
      ) : (
        <>
          <TableToolbar>
            <SearchInput value={query} onChange={setQuery} label="Search leads" />
            <FilterMenu
              label="Status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
            />
            <FilterMenu label="Owner" options={ownerOptions} value={owner} onChange={setOwner} />
            {sourceOptions.length > 2 ? (
              <FilterMenu
                label="Source"
                options={sourceOptions}
                value={source}
                onChange={setSource}
              />
            ) : null}
            {formName.size > 0 ? (
              <FilterMenu label="Form" options={formOptions} value={form} onChange={setForm} />
            ) : null}
            {hasFilters ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setStatus("open");
                  setOwner("all");
                  setSource("all");
                  setForm("all");
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </TableToolbar>

          <section aria-label="Leads" className="overflow-hidden rounded-lg border bg-card">
            {filtered.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No leads match"
                description="Try a different search or status."
                className="py-14"
              />
            ) : (
              <DataTable
                caption="Leads"
                columns={columns}
                rows={table.pageRows}
                getRowId={(lead) => lead.id}
                sort={table.sort}
                onSort={table.toggleSort}
              />
            )}
            <Pagination {...table.pagination} noun="leads" />
          </section>
        </>
      )}

      <ConvertLeadDialog lead={convertTarget} onClose={() => setConvertTarget(null)} />
      <EnquiryDialog
        lead={enquiryTarget}
        formName={enquiryTarget?.formId ? formName.get(enquiryTarget.formId) : undefined}
        onClose={() => setEnquiryTarget(null)}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={`Archive ${archiveTarget?.name ?? "lead"}?`}
        description="The lead leaves your open list. You can restore it from the Archived status."
        confirmLabel="Archive lead"
        onConfirm={async () => {
          if (!archiveTarget) return;
          if (!(await setLeadArchived(archiveTarget.id, true))) return;
          toast.success(`${archiveTarget.name} archived`, {
            action: { label: "Undo", onClick: () => setLeadArchived(archiveTarget.id, false) },
          });
          setArchiveTarget(null);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "lead"} for good?`}
        description={
          deleteTarget?.formId
            ? "The lead and the answers they sent through the form are removed and can’t be restored. To keep them out of your list but recoverable, archive the lead instead."
            : "The lead is removed and can’t be restored. To keep it out of your list but recoverable, archive it instead."
        }
        confirmLabel="Delete lead"
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (!(await deleteLead(deleteTarget.id))) return;
          toast.success(`${deleteTarget.name} deleted`);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
