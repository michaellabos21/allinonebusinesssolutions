"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addDays, parseAmountToMinor } from "@/lib/format";
import { getRuntime, getToday } from "@/lib/runtime";
import type { Lead } from "@/mocks";
import { convertLeadAction } from "@/server/actions/sales";

const NEW_CONTACT = "new";

/**
 * Turns a lead into a contact, and optionally a deal. The person is never
 * duplicated: a contact with the same email is reused automatically, or the
 * user can pick any existing contact. The server does it in one transaction.
 */
export function ConvertLeadDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  if (!lead) return null;
  // Keyed by lead, so each lead opens with fresh defaults.
  return <ConvertLeadForm key={lead.id} lead={lead} onClose={onClose} />;
}

function ConvertLeadForm({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const store = useDemoStore();
  const router = useRouter();
  const id = useId();
  const openStages = store.liveStages.filter((stage) => stage.kind === "open");
  const emailMatch = lead.email
    ? store.contacts.find((contact) => contact.email === lead.email)
    : undefined;

  const [contactChoice, setContactChoice] = useState(emailMatch?.id ?? NEW_CONTACT);
  const [createDeal, setCreateDeal] = useState(true);
  const [dealName, setDealName] = useState(`${lead.companyName || lead.name}: new work`);
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState(openStages[0]?.id ?? "");
  const [closeOn, setCloseOn] = useState(() => addDays(getToday(), 30));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const needsEmail = contactChoice === NEW_CONTACT && !lead.email;
  const activeContacts = store.contacts.filter((contact) => !contact.archived);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    const valueMinor = value.trim() ? parseAmountToMinor(value) : 0;
    if (needsEmail) next.contact = "Add an email to the lead first, or choose an existing contact.";
    if (createDeal) {
      if (!dealName.trim()) next.dealName = "Give the deal a name.";
      if (valueMinor === null) next.value = "Enter an amount like 45,000.";
      if (!closeOn) next.closeOn = "Choose an expected close date.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const result = await convertLeadAction({
        leadId: lead.id,
        contactId: contactChoice === NEW_CONTACT ? null : contactChoice,
        createDeal,
        dealName: createDeal ? dealName : "",
        valueMinor: createDeal ? (valueMinor ?? 0) : 0,
        stageId: createDeal ? stageId || null : null,
        expectedCloseOn: createDeal ? closeOn : null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const data = result.data;
      toast.success(`${lead.name} converted`, {
        description: data?.reusedContact
          ? "Linked to the existing contact."
          : "Added as a new contact.",
        action: data?.dealId
          ? { label: "View deal", onClick: () => router.push(`/crm/deals?deal=${data.dealId}`) }
          : data
            ? {
                label: "View contact",
                onClick: () => router.push(`/crm/contacts/${data.contactId}`),
              }
            : undefined,
      });
      onClose();
    } catch {
      toast.error("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form noValidate onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Convert {lead.name}</DialogTitle>
            <DialogDescription>
              The lead becomes a contact{lead.companyName ? ` at ${lead.companyName}` : ""}, and
              optionally a deal in your pipeline.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-contact`}>Contact</Label>
            <Select value={contactChoice} onValueChange={setContactChoice}>
              <SelectTrigger
                id={`${id}-contact`}
                className="w-full"
                aria-invalid={Boolean(errors.contact)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_CONTACT}>
                  {lead.email ? `New contact (${lead.email})` : "New contact"}
                </SelectItem>
                {activeContacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.name}, {contact.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {emailMatch && contactChoice === emailMatch.id ? (
              <p className="text-caption text-muted-foreground">
                {emailMatch.name} already has this email, so they’ll be used instead of a duplicate.
              </p>
            ) : null}
            {errors.contact || needsEmail ? (
              <p className="text-caption text-danger">
                {errors.contact ??
                  "This lead has no email. Choose an existing contact, or edit the lead to add one."}
              </p>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={createDeal}
              onChange={(event) => setCreateDeal(event.target.checked)}
              className="size-4 accent-primary"
            />
            Also create a deal
          </label>

          {createDeal ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id={`${id}-deal`} label="Deal name" error={errors.dealName} wide>
                <Input
                  id={`${id}-deal`}
                  value={dealName}
                  maxLength={160}
                  onChange={(event) => setDealName(event.target.value)}
                  aria-invalid={Boolean(errors.dealName)}
                />
              </Field>
              <Field
                id={`${id}-value`}
                label={`Value (${getRuntime().currency})`}
                error={errors.value}
              >
                <Input
                  id={`${id}-value`}
                  value={value}
                  inputMode="decimal"
                  placeholder="45,000"
                  onChange={(event) => setValue(event.target.value)}
                  aria-invalid={Boolean(errors.value)}
                />
              </Field>
              <Field id={`${id}-stage`} label="Stage">
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger id={`${id}-stage`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {openStages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id={`${id}-close`} label="Expected close" error={errors.closeOn}>
                <Input
                  id={`${id}-close`}
                  type="date"
                  value={closeOn}
                  onChange={(event) => setCloseOn(event.target.value)}
                  aria-invalid={Boolean(errors.closeOn)}
                />
              </Field>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="hover:bg-primary-hover" disabled={busy || needsEmail}>
              {busy ? "Converting…" : "Convert lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  wide,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-caption text-danger">{error}</p> : null}
    </div>
  );
}
