"use client";

import { Code2, Copy, ExternalLink, FileInput, Pencil, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import { LeadFormEditor } from "@/components/crm/lead-form-editor";
import { Textarea } from "@/components/ui/textarea";
import { addDays, formatDate } from "@/lib/format";
import { embedSnippet } from "@/lib/lead-forms";
import { getToday } from "@/lib/runtime";
import type { LeadForm } from "@/mocks";
import { can } from "@/server/permissions";

/** The public address of a form. Only its unguessable token identifies it. */
const formLink = (form: LeadForm) => `${window.location.origin}/f/${form.token}`;

export function LeadFormsScreen() {
  const store = useDemoStore();
  const canManage = can(store.account.workspace.role, "pipeline.manage");
  const [editing, setEditing] = useState<LeadForm | "new" | null>(null);
  const [embedding, setEmbedding] = useState<LeadForm | null>(null);
  const forms = store.leadForms;
  // All-time leads per form, and those in the same 30 days the view counts cover.
  const since = addDays(getToday(), -29);
  const counts = new Map<string, { total: number; recent: number }>();
  for (const lead of store.leads) {
    if (!lead.formId) continue;
    const count = counts.get(lead.formId) ?? { total: 0, recent: 0 };
    count.total += 1;
    if (lead.createdOn >= since) count.recent += 1;
    counts.set(lead.formId, count);
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
        description="Share a form’s link or embed it on your website. Each enquiry becomes a lead."
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
          {forms.map((form) => {
            const count = counts.get(form.id) ?? { total: 0, recent: 0 };
            const rate =
              form.viewsLast30Days > 0
                ? `${Math.round((count.recent / form.viewsLast30Days) * 1000) / 10}%`
                : "–";
            return (
              <li key={form.id} className="space-y-3 rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{form.name}</h2>
                    <p className="text-caption text-muted-foreground">
                      Created {formatDate(form.createdOn, "long")} · {form.fields.length} questions
                      · {count.total} {count.total === 1 ? "lead" : "leads"} in all
                    </p>
                  </div>
                  <Pill tone={form.active ? "success" : "neutral"}>
                    {form.active ? "Accepting enquiries" : "Switched off"}
                  </Pill>
                </div>
                <dl
                  className="grid grid-cols-3 gap-2 rounded-md bg-muted/60 px-3 py-2"
                  aria-label={`${form.name}, last 30 days`}
                >
                  {[
                    ["Views", String(form.viewsLast30Days)],
                    ["Leads", String(count.recent)],
                    ["Conversion", rate],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-caption text-muted-foreground">{label}</dt>
                      <dd className="tabular font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => copy(form)}>
                    <Copy data-icon="inline-start" aria-hidden />
                    Copy link
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEmbedding(form)}>
                    <Code2 data-icon="inline-start" aria-hidden />
                    Embed
                    <span className="sr-only"> {form.name}</span>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/f/${form.token}`} target="_blank" rel="noreferrer">
                      <ExternalLink data-icon="inline-start" aria-hidden />
                      Open
                      <span className="sr-only"> {form.name} in a new tab</span>
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/crm/leads?form=${form.id}`}>
                      <Users data-icon="inline-start" aria-hidden />
                      View leads
                      <span className="sr-only"> from {form.name}</span>
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(form)}>
                    <Pencil data-icon="inline-start" aria-hidden />
                    Edit
                    <span className="sr-only"> {form.name}</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-caption text-muted-foreground">
        Views, leads and conversion cover the last 30 days. Each form accepts up to 3 enquiries from
        one visitor every 10 minutes, and 100 an hour in total, to keep spam out.
      </p>

      <LeadFormDialog editing={editing} onClose={() => setEditing(null)} />
      <EmbedDialog form={embedding} onClose={() => setEmbedding(null)} />
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {editing !== null ? (
          // Keyed by form, so each one opens with its own values.
          <LeadFormEditor
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

/** The code that shows a form on the business's own website. */
function EmbedDialog({ form, onClose }: { form: LeadForm | null; onClose: () => void }) {
  const code = form ? embedSnippet(window.location.origin, form.token, form.name) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Embed code copied");
    } catch {
      toast.error("Couldn’t copy. Select the code and copy it instead.");
    }
  }

  return (
    <Dialog open={form !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Embed {form?.name}</DialogTitle>
          <DialogDescription>
            Paste this into your website where the form should appear: an HTML block in WordPress,
            Wix, Squarespace or your own pages. It sizes itself to fit, and records which page and
            campaign each enquiry came from.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          readOnly
          aria-label="Embed code"
          value={code}
          rows={10}
          className="font-mono text-xs"
          onFocus={(event) => event.target.select()}
        />
        <p className="text-caption text-muted-foreground">
          To track a campaign, add UTM tags to the link people click to reach that page, for example{" "}
          <span className="font-mono">?utm_source=facebook&amp;utm_campaign=october</span>. The same
          works on the form’s own link.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" className="hover:bg-primary-hover" onClick={copy}>
            <Copy data-icon="inline-start" aria-hidden />
            Copy code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
