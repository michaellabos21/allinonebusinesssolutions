"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
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
import { formatAmountInput, formatMoney, parseAmountToMinor } from "@/lib/format";
import { balanceMinor } from "@/lib/metrics";
import { runAction } from "@/lib/run-action";
import { getToday } from "@/lib/runtime";
import type { Invoice, PaymentMethod } from "@/mocks";
import {
  deleteInvoiceDraftAction,
  issueInvoiceAction,
  recordPaymentAction,
  voidInvoiceAction,
} from "@/server/actions/finance";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  card: "Card",
  e_wallet: "E-wallet",
  check: "Cheque",
  other: "Other",
};

const label = (invoice: Invoice) => invoice.number ?? "this draft";

/**
 * What can be done to an invoice, shared by the list and the detail page.
 * Every change goes to the server, which checks the role and the invoice's
 * status again. Nothing is emailed: email delivery isn't configured, so
 * issuing an invoice says so and leaves sending to the person.
 */
export function useInvoiceActions() {
  const router = useRouter();
  const [issueTarget, setIssueTarget] = useState<Invoice | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  return useMemo(
    () => ({
      askIssue: setIssueTarget,
      askPayment: setPaymentTarget,
      askVoid: setVoidTarget,
      askDelete: setDeleteTarget,
      dialogs: {
        issueTarget,
        paymentTarget,
        voidTarget,
        deleteTarget,
        close: () => {
          setIssueTarget(null);
          setPaymentTarget(null);
          setVoidTarget(null);
          setDeleteTarget(null);
        },
        onIssued: (number: string) =>
          toast.success(`Issued as ${number}`, {
            description: "Share it by link, or download it, to send to your client.",
          }),
        onDeleted: () => router.push("/money/invoices"),
      },
    }),
    [issueTarget, paymentTarget, voidTarget, deleteTarget, router],
  );
}

type Dialogs = ReturnType<typeof useInvoiceActions>["dialogs"];

/** The confirmation and form dialogs behind `useInvoiceActions`. Render once per screen. */
export function InvoiceActionDialogs(props: Dialogs) {
  const { issueTarget, paymentTarget, voidTarget, deleteTarget, close } = props;
  return (
    <>
      <ConfirmDialog
        open={issueTarget !== null}
        onOpenChange={(open) => !open && close()}
        title="Issue this invoice?"
        description="It gets the next invoice number and can no longer be edited. Email isn’t set up in this app, so nothing is sent: download or print the invoice and send it yourself."
        confirmLabel="Issue invoice"
        cancelLabel="Not yet"
        tone="default"
        onConfirm={async () => {
          if (!issueTarget) return;
          try {
            const result = await issueInvoiceAction(issueTarget.id);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            props.onIssued(result.data?.number ?? "");
            close();
          } catch {
            toast.error("We couldn’t reach the server. Check your connection and try again.");
          }
        }}
      />
      {paymentTarget ? (
        <PaymentDialog key={paymentTarget.id} invoice={paymentTarget} onClose={close} />
      ) : null}
      {voidTarget ? <VoidDialog key={voidTarget.id} invoice={voidTarget} onClose={close} /> : null}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && close()}
        title="Delete this draft?"
        description="Drafts were never issued, so deleting one leaves no gap in your numbering. This can’t be undone."
        confirmLabel="Delete draft"
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (await runAction(deleteInvoiceDraftAction(deleteTarget.id))) {
            toast.success("Draft deleted");
            close();
            props.onDeleted();
          }
        }}
      />
    </>
  );
}

/** Records money received by hand. Up to the amount still owed; never more. */
function PaymentDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const id = useId();
  const owed = balanceMinor(invoice);
  const [amount, setAmount] = useState(formatAmountInput(owed));
  const [paidOn, setPaidOn] = useState(getToday());
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const amountMinor = parseAmountToMinor(amount);
    const next: Record<string, string> = {};
    if (amountMinor === null || amountMinor <= 0) next.amountMinor = "Enter an amount above zero.";
    else if (amountMinor > owed) next.amountMinor = `No more than ${formatMoney(owed)} is owed.`;
    if (!paidOn) next.paidOn = "Choose the date it was received.";
    else if (paidOn > getToday()) next.paidOn = "The payment date can’t be in the future.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const result = await recordPaymentAction({
        invoiceId: invoice.id,
        amountMinor,
        paidOn,
        method,
        reference,
        note,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(
        amountMinor === owed
          ? `${invoice.number} is paid in full`
          : `Payment of ${formatMoney(amountMinor!)} recorded`,
      );
      onClose();
    } catch {
      toast.error("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form noValidate onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Record a payment for {invoice.number}</DialogTitle>
            <DialogDescription>
              {formatMoney(owed)} is still owed. Record money you have actually received; no payment
              is taken through this app.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id={`${id}-amount`}
              label={`Amount (${invoice.currency})`}
              error={errors.amountMinor}
            >
              <Input
                id={`${id}-amount`}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={Boolean(errors.amountMinor)}
              />
            </Field>
            <Field id={`${id}-date`} label="Date received" error={errors.paidOn}>
              <Input
                id={`${id}-date`}
                type="date"
                value={paidOn}
                max={getToday()}
                onChange={(event) => setPaidOn(event.target.value)}
                aria-invalid={Boolean(errors.paidOn)}
              />
            </Field>
            <Field id={`${id}-method`} label="Method">
              <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
                <SelectTrigger id={`${id}-method`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABEL).map(([value, text]) => (
                    <SelectItem key={value} value={value}>
                      {text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id={`${id}-ref`} label="Reference (optional)">
              <Input
                id={`${id}-ref`}
                value={reference}
                maxLength={120}
                placeholder="Bank reference"
                onChange={(event) => setReference(event.target.value)}
              />
            </Field>
            <Field id={`${id}-note`} label="Note (optional)" wide>
              <Input
                id={`${id}-note`}
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="hover:bg-primary-hover" disabled={busy}>
              {busy ? "Recording…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Cancels an issued, unpaid invoice. The number stays used. */
function VoidDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setError("Say why the invoice is being voided.");
      return;
    }
    setBusy(true);
    if (await runAction(voidInvoiceAction({ id: invoice.id, reason }))) {
      toast.success(`${label(invoice)} voided`);
      onClose();
    }
    setBusy(false);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form noValidate onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Void {invoice.number}?</DialogTitle>
            <DialogDescription>
              The invoice is cancelled and stays on record with its number, so your numbering has no
              gaps. It can’t be paid or reopened afterwards.
            </DialogDescription>
          </DialogHeader>
          <Field id={`${id}-reason`} label="Reason" error={error}>
            <Input
              id={`${id}-reason`}
              value={reason}
              maxLength={300}
              placeholder="Billed twice by mistake"
              onChange={(event) => {
                setReason(event.target.value);
                if (error) setError("");
              }}
              aria-invalid={Boolean(error)}
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Keep invoice
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              Void invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label: text,
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
      <Label htmlFor={id}>{text}</Label>
      {children}
      {error ? <p className="text-caption text-danger">{error}</p> : null}
    </div>
  );
}
