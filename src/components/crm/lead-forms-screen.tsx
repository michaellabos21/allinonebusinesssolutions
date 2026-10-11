"use client";

import { Copy, ExternalLink, FileInput, Pencil, Plus } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { Pill } from "@/components/common/status-badge";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import type { LeadForm } from "@/mocks";
import { saveLeadFormAction } from "@/server/actions/sales";
import { can } from "@/server/permissions";

const DEFAULT_SUCCESS = "Thanks, we’ll be in touch soon.";

/** The public address of a form. Only its unguessable token identifies it. */
const formLink = (form: LeadForm) => `${window.location.origin}/f/${form.token}`;

export function LeadFormsScreen() {
  const store = useDemoStore();
  const canManage = can(store.account.workspace.role, "pipeline.manage");
  const [editing, setEditing] = useState<LeadForm | "new" | null>(null);
  const forms = store.leadForms;
  const counts = new Map<string, number>();
  for (const lead of store.leads) {
    if (lead.formId) counts.set(lead.formId, (counts.get(lead.formId) ?? 0) + 1);
  }

  if (!canManage) {
    return (
      <div className="page-container space-y-5">
        <PageHeader title="Lead forms" description="Public enquiry forms for this workspace." />
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={FileInput}
            title="Managers look after lead forms"
            description="Leads that arrive through them appear under Leads for everyone on the team."
            className="py-14"
          />
        </div>
      </div>
    );
  }

  async function copy(form: LeadForm) {
    try {
      await navigator.clipboard.writeText(formLink(form));
      toast.success("Link copied");
    } catch {
      toast.error("Couldn’t copy. Open the form and copy its address instead.");
    }
  }

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Lead forms"
        description="Share a form’s link, or link to it from your website. Each enquiry becomes a lead."
        actions={
          <Button className="hover:bg-primary-hover" onClick={() => setEditing("new")}>
            <Plus data-icon="inline-start" aria-hidden />
            New form
          </Button>
        }
      />

      {forms.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={FileInput}
            title="No lead forms yet"
            description="Create a form, share its link, and enquiries arrive under Leads."
            action={
              <Button variant="outline" onClick={() => setEditing("new")}>
                New form
              </Button>
            }
            className="py-14"
          />
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" aria-label="Lead forms">
          {forms.map((form) => (
            <li key={form.id} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{form.name}</h2>
                  <p className="text-caption text-muted-foreground">
                    Created {formatDate(form.createdOn, "long")} · {counts.get(form.id) ?? 0}{" "}
                    {counts.get(form.id) === 1 ? "lead" : "leads"}
                  </p>
                </div>
                <Pill tone={form.active ? "success" : "neutral"}>
                  {form.active ? "Accepting enquiries" : "Switched off"}
                </Pill>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => copy(form)}>
                  <Copy data-icon="inline-start" aria-hidden />
                  Copy link
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/f/${form.token}`} target="_blank" rel="noreferrer">
                    <ExternalLink data-icon="inline-start" aria-hidden />
                    Open
                    <span className="sr-only"> {form.name} in a new tab</span>
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(form)}>
                  <Pencil data-icon="inline-start" aria-hidden />
                  Edit
                  <span className="sr-only"> {form.name}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-caption text-muted-foreground">
        Each form accepts up to 3 enquiries from one visitor every 10 minutes, and 100 an hour in
        total, to keep spam out.
      </p>

      <LeadFormDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function LeadFormDialog({
  editing,
  onClose,
}: {
  editing: LeadForm | "new" | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {editing !== null ? (
          // Keyed by form, so each one opens with its own values.
          <LeadFormFields
            key={editing === "new" ? "new" : editing.id}
            form={editing === "new" ? null : editing}
            busy={busy}
            setBusy={setBusy}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LeadFormFields({
  form,
  busy,
  setBusy,
  onClose,
}: {
  form: LeadForm | null;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [values, setValues] = useState({
    name: form?.name ?? "",
    intro: form?.intro ?? "",
    consentText: form?.consentText ?? "",
    successMessage: form?.successMessage ?? DEFAULT_SUCCESS,
    active: form?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (name: keyof typeof values, value: string | boolean) =>
    setValues((current) => ({ ...current, [name]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await saveLeadFormAction(values, form?.id);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(form ? "Form saved" : "Form created. Copy its link to share it.");
      onClose();
    } catch {
      toast.error("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{form ? `Edit ${form.name}` : "New lead form"}</DialogTitle>
        <DialogDescription>
          Visitors give their name, email, phone, company and a message. Each one becomes a new,
          unassigned lead.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-name`}>Form name</Label>
        <Input
          id={`${id}-name`}
          value={values.name}
          maxLength={80}
          placeholder="Website enquiry"
          onChange={(event) => set("name", event.target.value)}
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name ? <p className="text-caption text-danger">{errors.name}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-intro`}>Introduction (optional)</Label>
        <Textarea
          id={`${id}-intro`}
          value={values.intro}
          maxLength={500}
          placeholder="Tell us about your project and we’ll reply within a day."
          onChange={(event) => set("intro", event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-consent`}>Consent checkbox text (optional)</Label>
        <Textarea
          id={`${id}-consent`}
          value={values.consentText}
          maxLength={1000}
          placeholder="I agree to be contacted about my enquiry."
          onChange={(event) => set("consentText", event.target.value)}
        />
        <p className="text-caption text-muted-foreground">
          When filled in, visitors must tick a box with this text. Write it to suit your own privacy
          obligations; this app doesn’t provide legal wording.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-success`}>Message after sending</Label>
        <Input
          id={`${id}-success`}
          value={values.successMessage}
          maxLength={300}
          onChange={(event) => set("successMessage", event.target.value)}
          aria-invalid={Boolean(errors.successMessage)}
        />
        {errors.successMessage ? (
          <p className="text-caption text-danger">{errors.successMessage}</p>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={values.active}
          onChange={(event) => set("active", event.target.checked)}
          className="size-4 accent-primary"
        />
        Accepting enquiries
      </label>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="hover:bg-primary-hover" disabled={busy}>
          {form ? "Save form" : "Create form"}
        </Button>
      </DialogFooter>
    </form>
  );
}
