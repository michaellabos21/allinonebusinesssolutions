"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { runAction } from "@/lib/run-action";
import type { Estimate } from "@/mocks";
import {
  convertEstimateAction,
  decideEstimateAction,
  deleteEstimateDraftAction,
  sendEstimateAction,
} from "@/server/actions/finance";

type Ask = { kind: "send" | "accept" | "decline" | "convert" | "delete"; estimate: Estimate };

const label = (estimate: Estimate) => estimate.number ?? "this draft";

/**
 * What can be done to an estimate, shared by the list and the detail page.
 * The server checks the role and the estimate's status again for each step:
 * draft → sent → accepted or declined, and an accepted estimate becomes one
 * draft invoice, once.
 */
export function useEstimateActions() {
  const router = useRouter();
  const [ask, setAsk] = useState<Ask | null>(null);

  return useMemo(() => {
    const open = (kind: Ask["kind"]) => (estimate: Estimate) => setAsk({ kind, estimate });
    return {
      askSend: open("send"),
      askAccept: open("accept"),
      askDecline: open("decline"),
      askConvert: open("convert"),
      askDelete: open("delete"),
      dialogs: { ask, close: () => setAsk(null), router },
    };
  }, [ask, router]);
}

type Dialogs = ReturnType<typeof useEstimateActions>["dialogs"];

const COPY: Record<
  Ask["kind"],
  { title: string; description: string; confirm: string; tone?: "default" }
> = {
  send: {
    title: "Send this estimate?",
    description:
      "It gets the next estimate number and can no longer be edited. Email isn’t set up in this app, so nothing is sent: download or print it and send it yourself.",
    confirm: "Mark as sent",
    tone: "default",
  },
  accept: {
    title: "Mark as accepted?",
    description:
      "Record that the client said yes. You can then turn the estimate into a draft invoice.",
    confirm: "Mark accepted",
    tone: "default",
  },
  decline: {
    title: "Mark as declined?",
    description: "Record that the client said no. The estimate stays on record.",
    confirm: "Mark declined",
  },
  convert: {
    title: "Create an invoice from this estimate?",
    description:
      "A draft invoice is made with the same lines, discount and tax, due on your usual payment terms. You can review it before issuing. This can be done once per estimate.",
    confirm: "Create draft invoice",
    tone: "default",
  },
  delete: {
    title: "Delete this draft?",
    description:
      "Drafts were never sent, so deleting one leaves no gap in your numbering. This can’t be undone.",
    confirm: "Delete draft",
  },
};

/** The confirmations behind `useEstimateActions`. Render once per screen. */
export function EstimateActionDialogs({ ask, close, router }: Dialogs) {
  const copy = ask ? COPY[ask.kind] : COPY.send;

  async function confirm() {
    if (!ask) return;
    const { kind, estimate } = ask;
    try {
      if (kind === "send") {
        const result = await sendEstimateAction(estimate.id);
        if (!result.ok) return void toast.error(result.error);
        toast.success(`Sent as ${result.data?.number ?? "a numbered estimate"}`, {
          description: "Download or print it to send to your client.",
        });
      } else if (kind === "accept" || kind === "decline") {
        if (!(await runAction(decideEstimateAction(estimate.id, kind === "accept")))) return;
        toast.success(`${label(estimate)} marked ${kind === "accept" ? "accepted" : "declined"}`);
      } else if (kind === "convert") {
        const result = await convertEstimateAction(estimate.id);
        if (!result.ok || !result.data) {
          toast.error(
            result.ok ? "The server didn’t confirm the invoice. Reload and check." : result.error,
          );
          return;
        }
        toast.success("Draft invoice created", { description: "Review it, then issue it." });
        close();
        router.push(`/money/invoices/${result.data.invoiceId}`);
        return;
      } else {
        if (!(await runAction(deleteEstimateDraftAction(estimate.id)))) return;
        toast.success("Draft deleted");
        close();
        router.push("/money/estimates");
        return;
      }
      close();
    } catch {
      toast.error("We couldn’t reach the server. Check your connection and try again.");
    }
  }

  return (
    <ConfirmDialog
      open={ask !== null}
      onOpenChange={(open) => !open && close()}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirm}
      cancelLabel="Not now"
      tone={copy.tone}
      onConfirm={confirm}
    />
  );
}
