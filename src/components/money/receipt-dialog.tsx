"use client";

import { useId, useState } from "react";
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
import { formatDate, formatMoney } from "@/lib/format";
import type { Expense } from "@/mocks";
import { attachReceiptAction, receiptLinkAction } from "@/server/actions/finance";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Opens a receipt in a new tab. Receipts are private: the server checks
 * access and returns a link that stops working after a minute. The tab is
 * opened first, while the click still counts, so pop-up blockers allow it.
 */
export async function openReceipt(expenseId: string) {
  const tab = window.open("", "_blank");
  try {
    const result = await receiptLinkAction(expenseId);
    if (!result.ok || !result.data) {
      tab?.close();
      toast.error(result.ok ? "We couldn’t open the receipt." : result.error);
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = result.data.url;
    } else window.location.assign(result.data.url);
  } catch {
    tab?.close();
    toast.error("We couldn’t reach the server. Check your connection and try again.");
  }
}

/** Attaches a receipt file (photo or PDF, up to 5 MB) to an expense. */
export function ReceiptDialog({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setError("Choose a file to attach.");
    if (!ACCEPT.split(",").includes(file.type))
      return setError("Attach a JPEG, PNG, WebP, HEIC or PDF file.");
    if (file.size > MAX_BYTES) return setError("Receipts can be up to 5 MB.");

    const data = new FormData();
    data.set("expenseId", expense.id);
    data.set("file", file);
    setBusy(true);
    try {
      const result = await attachReceiptAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(expense.receiptPath ? "Receipt replaced" : "Receipt attached");
      onClose();
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form noValidate onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {expense.receiptPath ? "Replace receipt" : "Attach a receipt"}
            </DialogTitle>
            <DialogDescription>
              {formatMoney(expense.amountMinor, { currency: expense.currency })} to {expense.vendor}{" "}
              on {formatDate(expense.date, "long")}. Receipts are private to people who manage
              finance in this workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-file`}>Photo or PDF, up to 5 MB</Label>
            <Input
              id={`${id}-file`}
              type="file"
              accept={ACCEPT}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError("");
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            {error ? (
              <p id={`${id}-error`} className="text-caption text-danger">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="hover:bg-primary-hover" disabled={busy}>
              {busy ? "Uploading…" : "Attach receipt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
