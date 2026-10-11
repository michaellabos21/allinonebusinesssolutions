"use client";

import { Archive, ArchiveRestore, Eye, Pencil, Plus, SearchX, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { type Column, DataTable, Pagination, useTableState } from "@/components/common/data-table";
import { PageHeader } from "@/components/common/page-header";
import { RowActions } from "@/components/common/row-actions";
import { EmptyState } from "@/components/common/states";
import { ContactStatusBadge, Pill } from "@/components/common/status-badge";
import { FilterMenu, MultiFilterMenu, SearchInput, TableToolbar } from "@/components/common/table-toolbar";
import { UserAvatar } from "@/components/common/user-avatar";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { CONTACT_TAGS, type Contact } from "@/mocks";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "lead", label: "Lead" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

export function ContactsScreen() {
  const { contacts, companyName, openQuickCreate, openEditor, setContactArchived } = useDemoStore();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [tags, setTags] = useState<string[]>([]);
  const [archiveTarget, setArchiveTarget] = useState<Contact | null>(null);

  const tagOptions = useMemo(
    () =>
      [...new Set([...CONTACT_TAGS, ...contacts.flatMap((contact) => contact.tags)])].map((tag) => ({
        value: tag,
        label: tag,
      })),
    [contacts],
  );

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (status === "archived" ? !contact.archived : contact.archived) return false;
      if (status !== "all" && status !== "archived" && contact.status !== status) return false;
      if (tags.length > 0 && !tags.some((tag) => contact.tags.includes(tag))) return false;
      if (!text) return true;
      return [contact.name, contact.email, companyName(contact.companyId)].some((value) =>
        value.toLowerCase().includes(text),
      );
    });
  }, [contacts, companyName, query, status, tags]);

  const columns = useMemo<Column<Contact>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        sortValue: (contact) => contact.name,
        cell: (contact) => (
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar name={contact.name} />
            <div className="min-w-0">
              <Link href={`/crm/contacts/${contact.id}`} className="block truncate font-medium hover:underline">
                {contact.name}
              </Link>
              <span className="block truncate text-caption text-muted-foreground">{contact.email}</span>
            </div>
          </div>
        ),
      },
      {
        id: "company",
        header: "Company",
        sortValue: (contact) => companyName(contact.companyId),
        className: "hidden sm:table-cell",
        cell: (contact) =>
          contact.companyId ? (
            <Link href={`/crm/companies/${contact.companyId}`} className="hover:underline">
              {companyName(contact.companyId)}
            </Link>
          ) : (
            <span className="text-muted-foreground">None</span>
          ),
      },
      {
        id: "status",
        header: "Status",
        sortValue: (contact) => contact.status,
        cell: (contact) => <ContactStatusBadge status={contact.status} archived={contact.archived} />,
      },
      {
        id: "tags",
        header: "Tags",
        className: "hidden lg:table-cell",
        cell: (contact) => (
          <div className="flex flex-wrap gap-1">
            {contact.tags.map((tag) => (
              <Pill key={tag}>{tag}</Pill>
            ))}
          </div>
        ),
      },
      {
        id: "added",
        header: "Added",
        sortValue: (contact) => contact.createdOn,
        className: "hidden md:table-cell",
        cell: (contact) => (
          <span className="tabular whitespace-nowrap text-muted-foreground">
            {formatDate(contact.createdOn, "long")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        hideHeader: true,
        align: "right",
        cell: (contact) => (
          <RowActions
            label={`Actions for ${contact.name}`}
            actions={[
              { label: "View", icon: Eye, href: `/crm/contacts/${contact.id}` },
              { label: "Edit", icon: Pencil, onSelect: () => openEditor("contact", contact.id) },
              contact.archived
                ? {
                    label: "Restore",
                    icon: ArchiveRestore,
                    onSelect: () => {
                      setContactArchived(contact.id, false);
                      toast.success(`${contact.name} restored`);
                    },
                  }
                : { label: "Archive", icon: Archive, destructive: true, onSelect: () => setArchiveTarget(contact) },
            ]}
          />
        ),
      },
    ],
    [companyName, openEditor, setContactArchived],
  );

  const table = useTableState(filtered, columns, { initialSort: { id: "name", direction: "asc" } });
  const hasFilters = query !== "" || status !== "all" || tags.length > 0;

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Contacts"
        description="Everyone you work with or are talking to, across clients and leads."
        actions={
          <Button className="hover:bg-primary-hover" onClick={() => openQuickCreate("contact")}>
            <Plus data-icon="inline-start" aria-hidden />
            New contact
          </Button>
        }
      />

      {contacts.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={UserRound}
            title="No contacts yet"
            description="Add the first person you work with, or turn demo data on in the sidebar."
            action={
              <Button variant="outline" onClick={() => openQuickCreate("contact")}>
                New contact
              </Button>
            }
            className="py-14"
          />
        </div>
      ) : (
        <>
          <TableToolbar>
            <SearchInput value={query} onChange={setQuery} label="Search contacts" />
            <FilterMenu label="Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
            <MultiFilterMenu label="Tags" options={tagOptions} values={tags} onChange={setTags} />
            {hasFilters ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setTags([]);
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </TableToolbar>

          <section aria-label="Contacts" className="overflow-hidden rounded-lg border bg-card">
            {filtered.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No contacts match"
                description="Try a different search, or clear the filters to see everyone."
                className="py-14"
              />
            ) : (
              <DataTable
                caption="Contacts"
                columns={columns}
                rows={table.pageRows}
                getRowId={(contact) => contact.id}
                sort={table.sort}
                onSort={table.toggleSort}
              />
            )}
            <Pagination {...table.pagination} noun="contacts" />
          </section>
        </>
      )}

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={`Archive ${archiveTarget?.name ?? "contact"}?`}
        description="They move out of your lists and pickers. Their invoices, projects and notes are kept, and you can restore them from the Archived filter."
        confirmLabel="Archive contact"
        onConfirm={() => {
          if (!archiveTarget) return;
          setContactArchived(archiveTarget.id, true);
          toast.success(`${archiveTarget.name} archived`, {
            action: { label: "Undo", onClick: () => setContactArchived(archiveTarget.id, false) },
          });
          setArchiveTarget(null);
        }}
      />
    </div>
  );
}
