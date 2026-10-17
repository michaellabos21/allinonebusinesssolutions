"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { ATTRIBUTION_KEYS, ATTRIBUTION_LABEL, type Attribution } from "@/lib/lead-forms";
import type { Lead } from "@/mocks";

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** One line on where a lead came from: its campaign tags, else the referring site. */
export function attributionSummary(attribution: Attribution) {
  const tags = [attribution.utm_source, attribution.utm_medium, attribution.utm_campaign].filter(
    Boolean,
  );
  if (tags.length > 0) return `via ${tags.join(" / ")}`;
  if (attribution.referrer) return `from ${hostOf(attribution.referrer)}`;
  return "";
}

/** What a visitor sent through a lead form, as they sent it, and where they came from. */
export function EnquiryDialog({
  lead,
  formName,
  onClose,
}: {
  lead: Lead | null;
  formName?: string;
  onClose: () => void;
}) {
  const trail = lead
    ? ATTRIBUTION_KEYS.filter((key) => lead.attribution[key]).map((key) => ({
        key,
        label: ATTRIBUTION_LABEL[key],
        value: lead.attribution[key]!,
      }))
    : [];
  const details = lead
    ? [
        ["Email", lead.email],
        ["Phone", lead.phone],
        ["Company", lead.companyName],
      ].filter(([, value]) => value)
    : [];

  return (
    <Dialog open={lead !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enquiry from {lead?.name}</DialogTitle>
          <DialogDescription>
            {formName ? `Sent through “${formName}”` : "Sent through a lead form"}
            {lead ? ` on ${formatDate(lead.createdOn, "long")}.` : "."}
          </DialogDescription>
        </DialogHeader>
        {lead ? (
          <div className="grid gap-5">
            <dl className="grid gap-2">
              {details.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[8rem_1fr] gap-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 break-words">{value}</dd>
                </div>
              ))}
              {lead.answers.map((answer) => (
                <div key={answer.key} className="grid grid-cols-[8rem_1fr] gap-2">
                  <dt className="text-muted-foreground">{answer.label}</dt>
                  <dd className="min-w-0 break-words whitespace-pre-wrap">{answer.value}</dd>
                </div>
              ))}
            </dl>
            {lead.notes ? (
              <section className="grid gap-1">
                <h3 className="text-sm font-semibold">Message and notes</h3>
                <p className="whitespace-pre-wrap">{lead.notes}</p>
              </section>
            ) : null}
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">Where they came from</h3>
              {trail.length > 0 ? (
                <dl className="grid gap-2">
                  {trail.map((item) => (
                    <div key={item.key} className="grid grid-cols-[8rem_1fr] gap-2">
                      <dt className="text-muted-foreground">{item.label}</dt>
                      <dd className="min-w-0 break-all">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-muted-foreground">
                  Nothing recorded: they opened the form’s link directly, with no campaign tags.
                </p>
              )}
            </section>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
