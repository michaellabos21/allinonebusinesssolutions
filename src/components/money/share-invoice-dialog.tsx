"use client";

import { Copy, RefreshCw, Share2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

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
import { formatDate, formatMoney } from "@/lib/format";
import type { Invoice } from "@/mocks";
import { resetInvoiceShareLinkAction, shareInvoiceAction } from "@/server/actions/finance";

/** The message a business sends with the link, ready for Messenger, Viber, SMS or email. */
export function shareMessage(invoice: Invoice, businessName: string, link: string) {
  const first = invoice.billTo?.name.trim().split(/\s+/)[0];
  const hello = first ? `Hi ${first}, here’s` : "Here’s";
  if (invoice.status === "paid") {
    return `${hello} your paid invoice ${invoice.number} from ${businessName}: ${link}`;
  }
  const owed = formatMoney(invoice.amountMinor - invoice.paidMinor, { currency: invoice.currency });
  return `${hello} invoice ${invoice.number} from ${businessName} for ${owed}, due ${formatDate(invoice.dueOn, "long")}: ${link}`;
}

/** Share an issued invoice by link: copy it, copy a ready message, or use the phone's share sheet. */
export function ShareInvoiceDialog({
  invoice,
  businessName,
  open,
  onOpenChange,
}: {
  invoice: Invoice;
  businessName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <ShareContent
            invoice={invoice}
            businessName={businessName}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ShareContent({
  invoice,
  businessName,
  onClose,
}: {
  invoice: Invoice;
  businessName: string;
  onClose: () => void;
}) {
  const id = useId();
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [canShare] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
  );

  const show = (token: string) => {
    const url = `${window.location.origin}/i/${token}`;
    setLink(url);
    setMessage(shareMessage(invoice, businessName, url));
  };

  // The link is made (or found) as the dialog opens.
  useEffect(() => {
    let live = true;
    shareInvoiceAction(invoice.id)
      .then((result) => {
        if (!live) return;
        if (result.ok) show(result.data!.token);
        else {
          toast.error(result.error);
          onClose();
        }
      })
      .catch(() => {
        if (live) toast.error("We couldn’t reach the server. Check your connection and try again.");
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id]);

  async function replace() {
    setBusy(true);
    try {
      const cleared = await resetInvoiceShareLinkAction(invoice.id);
      const result = cleared.ok ? await shareInvoiceAction(invoice.id) : cleared;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      show((result.data as { token: string }).token);
      toast.success("New link made. The old one no longer works.");
    } catch {
      toast.error("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Couldn’t copy. Select the text and copy it instead.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Invoice ${invoice.number}`, text: message });
    } catch {
      // Closing the share sheet is not an error.
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Share {invoice.number}</DialogTitle>
        <DialogDescription>
          Send this link by Messenger, Viber, SMS or email. Your client sees this invoice and can
          save it as a PDF; they don’t need an account.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-link`}>Link</Label>
          <div className="flex gap-2">
            <Input
              id={`${id}-link`}
              readOnly
              value={link ?? "Making the link…"}
              onFocus={(event) => event.target.select()}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!link}
              onClick={() => link && copy(link, "Link")}
            >
              <Copy data-icon="inline-start" aria-hidden />
              Copy link
            </Button>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-message`}>Message</Label>
          <Textarea
            id={`${id}-message`}
            rows={4}
            value={message}
            disabled={!link}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
        <p className="text-caption text-muted-foreground">
          Anyone with the link can see this invoice.{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline disabled:opacity-50"
            disabled={busy || !link}
            onClick={replace}
          >
            <RefreshCw className="mr-1 inline size-3" aria-hidden />
            Replace the link
          </button>{" "}
          if it went to the wrong person.
        </p>
      </div>
      <DialogFooter>
        {canShare ? (
          <Button type="button" variant="outline" disabled={!link} onClick={share}>
            <Share2 data-icon="inline-start" aria-hidden />
            Share…
          </Button>
        ) : null}
        <Button
          type="button"
          className="hover:bg-primary-hover"
          disabled={!link}
          onClick={() => copy(message, "Message")}
        >
          <Copy data-icon="inline-start" aria-hidden />
          Copy message
        </Button>
      </DialogFooter>
    </>
  );
}
