"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/providers/demo-store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DEMO_TODAY } from "@/config/app";
import { formatDate, formatMoney } from "@/lib/format";
import { useFocusReturn } from "@/lib/use-focus-return";
import type { Invoice } from "@/mocks";

/**
 * Status changes for an invoice, shared by the list and the detail page.
 * Both are simulated: nothing is emailed and no money moves.
 */
export function useInvoiceActions() {
  const { markInvoiceSent, recordInvoicePayment } = useDemoStore();
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);

  return useMemo(
    () => ({
      markSent: (invoice: Invoice) => {
        markInvoiceSent(invoice.id);
        toast.success(`${invoice.number} marked as sent`, {
          description: "Simulated. No email went to the client.",
        });
      },
      askPayment: (invoice: Invoice) => setPaymentTarget(invoice),
      paymentDialog: {
        invoice: paymentTarget,
        onClose: () => setPaymentTarget(null),
        onConfirm: () => {
          if (!paymentTarget) return;
          recordInvoicePayment(paymentTarget.id);
          toast.success(`Payment recorded for ${paymentTarget.number}`, {
            description: "Simulated. No money was moved.",
          });
          setPaymentTarget(null);
        },
      },
    }),
    [markInvoiceSent, recordInvoicePayment, paymentTarget],
  );
}

export function PaymentDialog({
  invoice,
  onClose,
  onConfirm,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const returnFocus = useFocusReturn(invoice !== null);
  return (
    <AlertDialog open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent onCloseAutoFocus={returnFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>Record payment for {invoice?.number}?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks {invoice ? formatMoney(invoice.amountMinor) : "the invoice"} as paid in full on{" "}
            {formatDate(DEMO_TODAY, "long")}. It is a simulated action: no payment is processed and no money
            is moved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Record payment (simulated)</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
