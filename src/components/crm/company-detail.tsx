"use client";

import { Archive, ArchiveRestore, Building2, Pencil, Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  CompanyTypeBadge,
  ContactStatusBadge,
  DealStageBadge,
  InvoiceStatusBadge,
  ProjectStatusBadge,
} from "@/components/common/status-badge";
import { BackLink, MissingRecord, RelatedList } from "@/components/crm/shared";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { getCompanyRollup } from "@/lib/crm";
import { formatDate, formatMoney, initials } from "@/lib/format";
import { invoiceDisplayStatus } from "@/lib/metrics";
import { setCompanyArchived } from "@/lib/record-actions";

export function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const store = useDemoStore();
  const [confirmArchive, setConfirmArchive] = useState(false);

  const company = store.companies.find((item) => item.id === id);
  if (!company) {
    return (
      <MissingRecord
        icon={Building2}
        noun="company"
        listHref="/crm/companies"
        listLabel="Back to companies"
      />
    );
  }

  const rollup = getCompanyRollup(company, store);
  const projects = store.projects.filter(
    (project) => project.contactId && rollup.contactIds.has(project.contactId),
  );
  const contactName = (contactId: string | null) =>
    store.contacts.find((contact) => contact.id === contactId)?.name ?? "";

  const figures = [
    { label: "Contacts", value: String(rollup.people.length), note: "People at this company." },
    {
      label: "Open deals",
      value: formatMoney(rollup.openDealMinor),
      note: `${rollup.openDealCount} ${rollup.openDealCount === 1 ? "deal" : "deals"} in the pipeline.`,
    },
    {
      label: "Invoiced",
      value: formatMoney(rollup.billedMinor),
      note: "Sent and paid invoices, all time.",
    },
    {
      label: "Unpaid",
      value: formatMoney(rollup.unpaidMinor),
      note: rollup.overdueCount > 0 ? `${rollup.overdueCount} overdue.` : "Nothing overdue.",
    },
  ];

  return (
    <div className="page-container space-y-6">
      <BackLink href="/crm/companies" label="Companies" />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary-soft font-display text-lg font-semibold text-primary"
          >
            {initials(company.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-display text-title">{company.name}</h1>
              <CompanyTypeBadge type={company.type} archived={company.archived} />
            </div>
            <p className="mt-0.5 text-muted-foreground">
              {[company.industry, company.city, company.website].filter(Boolean).join(", ") ||
                "No details yet"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => store.openEditor("company", company.id)}>
            <Pencil data-icon="inline-start" aria-hidden />
            Edit
          </Button>
          {company.archived ? (
            <Button
              variant="outline"
              onClick={async () => {
                if (!(await setCompanyArchived(company.id, false))) return;
                toast.success(`${company.name} restored`);
              }}
            >
              <ArchiveRestore data-icon="inline-start" aria-hidden />
              Restore
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setConfirmArchive(true)}>
              <Archive data-icon="inline-start" aria-hidden />
              Archive
            </Button>
          )}
        </div>
      </header>

      {company.archived ? (
        <p className="rounded-lg border bg-warning-soft px-4 py-2.5 text-warning">
          This company is archived. It is hidden from lists and pickers until restored.
        </p>
      ) : null}

      <section aria-label="Summary" className="overflow-hidden rounded-lg border bg-card">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {figures.map((figure) => (
            <div key={figure.label} className="-mt-px -ml-px border-t border-l px-5 py-4">
              <dt className="text-muted-foreground">{figure.label}</dt>
              <dd className="mt-1">
                <span className="block font-display text-figure">{figure.value}</span>
                <span className="mt-1 block text-caption text-muted-foreground">{figure.note}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <RelatedList
          title="People"
          empty="No contacts at this company yet."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => store.openQuickCreate("contact", { companyName: company.name })}
            >
              <Plus data-icon="inline-start" aria-hidden />
              Add contact
            </Button>
          }
          rows={rollup.people.map((contact) => ({
            id: contact.id,
            primary: contact.name,
            secondary: contact.email,
            meta: <ContactStatusBadge status={contact.status} />,
            href: `/crm/contacts/${contact.id}`,
          }))}
        />
        <RelatedList
          title="Deals"
          empty="No deals with this company yet."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => store.openQuickCreate("deal", { companyId: company.id })}
            >
              <Plus data-icon="inline-start" aria-hidden />
              Add deal
            </Button>
          }
          rows={rollup.deals.map((deal) => ({
            id: deal.id,
            primary: deal.name,
            secondary: `${formatMoney(deal.valueMinor)}, ${contactName(deal.contactId) || "no contact"}`,
            meta: <DealStageBadge stage={store.stageOf(deal.stageId)} />,
            href: `/crm/deals?deal=${deal.id}`,
          }))}
        />
        <RelatedList
          title="Projects"
          empty="No projects for this company."
          rows={projects.map((project) => ({
            id: project.id,
            primary: project.name,
            secondary: `Due ${formatDate(project.dueOn, "long")}`,
            meta: <ProjectStatusBadge status={project.status} />,
            href: `/work/projects/${project.id}`,
          }))}
        />
        <RelatedList
          title="Invoices"
          empty="No invoices for this company."
          rows={rollup.invoices.map((invoice) => ({
            id: invoice.id,
            primary: `${invoice.number}, ${formatMoney(invoice.amountMinor)}`,
            secondary: invoice.description,
            meta: <InvoiceStatusBadge status={invoiceDisplayStatus(invoice)} />,
            href: `/money/invoices/${invoice.id}`,
          }))}
        />
      </div>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archive ${company.name}?`}
        description="The company moves out of your lists and pickers. Its contacts, deals and invoices are kept, and you can restore it at any time."
        confirmLabel="Archive company"
        onConfirm={async () => {
          if (!(await setCompanyArchived(company.id, true))) return;
          toast.success(`${company.name} archived`);
          setConfirmArchive(false);
        }}
      />
    </div>
  );
}
