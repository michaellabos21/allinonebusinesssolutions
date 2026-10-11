"use client";

import {
  Archive,
  ArchiveRestore,
  Banknote,
  NotebookPen,
  Pencil,
  ReceiptText,
  UserRound,
  UserRoundPlus,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Panel } from "@/components/common/panel";
import {
  ContactStatusBadge,
  DealStageBadge,
  InvoiceStatusBadge,
  Pill,
  ProjectStatusBadge,
} from "@/components/common/status-badge";
import { PhotoPicker } from "@/components/common/photo-picker";
import { UserAvatar } from "@/components/common/user-avatar";
import { BackLink, MissingRecord, RelatedList } from "@/components/crm/shared";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type TimelineEvent, getContactTimeline } from "@/lib/crm";
import { formatDate, formatMoney, formatRelativeDay } from "@/lib/format";
import { invoiceDisplayStatus } from "@/lib/metrics";
import { setContactArchived, addNote } from "@/lib/record-actions";
import { memberName, memberPhoto } from "@/lib/runtime";
import { removeContactPhotoAction, uploadContactPhotoAction } from "@/server/actions/photos";
import { can } from "@/server/permissions";

const TIMELINE_ICON: Record<TimelineEvent["kind"], typeof UserRound> = {
  created: UserRoundPlus,
  note: NotebookPen,
  invoice: ReceiptText,
  payment: Banknote,
};

export function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const store = useDemoStore();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [draft, setDraft] = useState("");
  const [noteError, setNoteError] = useState("");
  const noteId = useId();

  const contact = store.contacts.find((item) => item.id === id);
  if (!contact) {
    return (
      <MissingRecord
        icon={UserRound}
        noun="contact"
        listHref="/crm/contacts"
        listLabel="Back to contacts"
      />
    );
  }

  const company = store.companyName(contact.companyId);
  const canEdit = can(store.account.workspace.role, "records.edit");
  const notes = store.notes.filter((note) => note.contactId === contact.id);
  const invoices = store.invoices.filter((invoice) => invoice.contactId === contact.id);
  const projects = store.projects.filter((project) => project.contactId === contact.id);
  const deals = store.deals.filter((deal) => deal.contactId === contact.id && !deal.archived);
  const timeline = getContactTimeline(contact, { notes: store.notes, invoices: store.invoices });

  async function saveNote(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) {
      setNoteError("Write a note before saving.");
      document.getElementById(noteId)?.focus();
      return;
    }
    if (!(await addNote(contact!.id, body))) return;
    setDraft("");
    toast.success("Note added");
  }

  return (
    <div className="page-container space-y-6">
      <BackLink href="/crm/contacts" label="Contacts" />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {canEdit ? (
            <PhotoPicker
              layout="overlay"
              name={contact.name}
              photoPath={contact.photoPath}
              onUpload={(form) => {
                form.set("contactId", contact.id);
                return uploadContactPhotoAction(form);
              }}
              onRemove={() => removeContactPhotoAction(contact.id)}
              avatarClassName="size-14 [&_[data-slot=avatar-fallback]]:text-lg"
            />
          ) : (
            <UserAvatar
              name={contact.name}
              photoPath={contact.photoPath}
              className="size-14 [&_[data-slot=avatar-fallback]]:text-lg"
            />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-display text-title">{contact.name}</h1>
              <ContactStatusBadge status={contact.status} archived={contact.archived} />
            </div>
            <p className="mt-0.5 text-muted-foreground">
              {contact.companyId ? (
                <Link
                  href={`/crm/companies/${contact.companyId}`}
                  className="hover:text-foreground hover:underline"
                >
                  {company}
                </Link>
              ) : (
                "No company"
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => store.openEditor("contact", contact.id)}>
            <Pencil data-icon="inline-start" aria-hidden />
            Edit
          </Button>
          {contact.archived ? (
            <Button
              variant="outline"
              onClick={async () => {
                if (!(await setContactArchived(contact.id, false))) return;
                toast.success(`${contact.name} restored`);
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

      {contact.archived ? (
        <p className="rounded-lg border bg-warning-soft px-4 py-2.5 text-warning">
          This contact is archived. They are hidden from lists and pickers until restored.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel
            title="Notes"
            description={`${notes.length} ${notes.length === 1 ? "note" : "notes"} on this contact.`}
          >
            <form onSubmit={saveNote} noValidate>
              <label htmlFor={noteId} className="sr-only">
                New note
              </label>
              <Textarea
                id={noteId}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (noteError) setNoteError("");
                }}
                placeholder={`What should the team remember about ${contact.name.split(" ")[0]}?`}
                aria-invalid={Boolean(noteError)}
                aria-describedby={noteError ? `${noteId}-error` : undefined}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p id={`${noteId}-error`} className="text-caption text-danger">
                  {noteError}
                </p>
                <Button type="submit" variant="outline">
                  Add note
                </Button>
              </div>
            </form>
            {notes.length > 0 ? (
              <ul className="mt-4 space-y-4 border-t pt-4">
                {notes.map((note) => {
                  const author = memberName(note.authorId);
                  return (
                    <li key={note.id} className="flex gap-3">
                      <UserAvatar
                        name={author}
                        photoPath={memberPhoto(note.authorId)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="text-caption text-muted-foreground">
                          <span className="mr-2 font-medium text-foreground">{author}</span>
                          {formatRelativeDay(note.at)}
                        </p>
                        <p className="mt-0.5 max-w-[70ch] whitespace-pre-wrap">{note.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </Panel>

          <Panel title="Activity" description="Built from this contact’s notes and invoices.">
            <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-3 before:w-px before:bg-border">
              {timeline.map((event) => {
                const Icon = TIMELINE_ICON[event.kind];
                return (
                  <li key={event.id} className="relative flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground">
                      <Icon className="size-3" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="font-medium">{event.title}</p>
                        <p className="tabular text-caption text-muted-foreground">
                          {formatDate(event.at, "long")}
                        </p>
                      </div>
                      {event.detail ? (
                        <p className="mt-0.5 line-clamp-2 text-caption text-muted-foreground">
                          {event.detail}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Details">
            <dl className="space-y-3">
              <div>
                <dt className="text-caption text-muted-foreground">Email</dt>
                <dd className="break-words">
                  <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                    {contact.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Phone</dt>
                <dd className="tabular">{contact.phone || "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Tags</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {contact.tags.length > 0
                    ? contact.tags.map((tag) => <Pill key={tag}>{tag}</Pill>)
                    : "None"}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">Added</dt>
                <dd className="tabular">{formatDate(contact.createdOn, "long")}</dd>
              </div>
            </dl>
          </Panel>

          <RelatedList
            title="Deals"
            empty="No deals with this contact."
            rows={deals.map((deal) => ({
              id: deal.id,
              primary: deal.name,
              secondary: formatMoney(deal.valueMinor),
              meta: <DealStageBadge stage={store.stageOf(deal.stageId)} />,
              href: `/crm/deals?deal=${deal.id}`,
            }))}
          />
          <RelatedList
            title="Projects"
            empty="No projects for this contact."
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
            empty="No invoices for this contact."
            rows={invoices.map((invoice) => ({
              id: invoice.id,
              primary: `${invoice.number}, ${formatMoney(invoice.amountMinor)}`,
              secondary: invoice.description,
              meta: <InvoiceStatusBadge status={invoiceDisplayStatus(invoice)} />,
              href: `/money/invoices/${invoice.id}`,
            }))}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archive ${contact.name}?`}
        description="They move out of your lists and pickers. Their invoices, projects and notes are kept, and you can restore them at any time."
        confirmLabel="Archive contact"
        onConfirm={async () => {
          if (!(await setContactArchived(contact.id, true))) return;
          toast.success(`${contact.name} archived`);
          setConfirmArchive(false);
        }}
      />
    </div>
  );
}
