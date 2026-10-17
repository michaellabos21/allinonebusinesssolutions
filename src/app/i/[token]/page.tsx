import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { InvoiceDocument } from "@/components/money/invoice-document";
import { PrintButton } from "@/components/public/print-button";
import { PRODUCT_NAME } from "@/config/app";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type SharedInvoice, getSharedInvoice } from "@/server/shared-invoices";

export const metadata: Metadata = {
  title: "Invoice",
  // Shared on purpose with one client; never something to find by searching.
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

/** One line on where the invoice stands, in the client's terms. */
function standing(invoice: SharedInvoice): {
  text: string;
  tone: "success" | "danger" | "neutral";
} {
  const money = (amount: number) => formatMoney(amount, { currency: invoice.currency });
  const owed = invoice.totalMinor - invoice.paidMinor;
  const due = formatDate(invoice.dueOn, "long");
  if (invoice.status === "void") return { text: "This invoice was cancelled.", tone: "neutral" };
  if (invoice.status === "paid") return { text: "Paid in full. Thank you!", tone: "success" };
  const paid = invoice.paidMinor > 0 ? `${money(invoice.paidMinor)} received. ` : "";
  if (invoice.dueOn < invoice.today) {
    return { text: `${paid}${money(owed)} is overdue. It was due ${due}.`, tone: "danger" };
  }
  return { text: `${paid}${money(owed)} due ${due}.`, tone: "neutral" };
}

async function InvoicePage({ params }: Props) {
  const { token } = await params;
  const invoice = await getSharedInvoice(token);
  if (!invoice) {
    return (
      <main className="w-full max-w-md rounded-lg border bg-card px-5 py-6 sm:px-6">
        <h1 className="font-display text-xl font-semibold">This invoice isn’t available</h1>
        <p className="mt-2 text-muted-foreground">
          The link may be incomplete, or the business has replaced it with a new one. Ask them for
          the latest link.
        </p>
      </main>
    );
  }
  const status = standing(invoice);
  return (
    <main className="w-full max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-xl font-semibold">
            Invoice {invoice.number} from {invoice.businessName}
          </h1>
          <p
            className={cn(
              "mt-0.5",
              status.tone === "success" && "font-medium text-success",
              status.tone === "danger" && "font-medium text-danger",
              status.tone === "neutral" && "text-muted-foreground",
            )}
          >
            {status.text}
          </p>
        </div>
        <PrintButton />
      </div>
      <InvoiceDocument
        workspaceName={invoice.businessName}
        billTo={invoice.billTo}
        doc={{
          kind: "Invoice",
          number: invoice.number,
          currency: invoice.currency,
          issuedOn: invoice.issuedOn,
          endsOn: invoice.dueOn,
          items: invoice.items,
          subtotalMinor: invoice.subtotalMinor,
          discountMinor: invoice.discountMinor,
          taxRateBps: invoice.taxRateBps,
          taxMinor: invoice.taxMinor,
          totalMinor: invoice.totalMinor,
          paidMinor: invoice.paidMinor,
          notes: invoice.notes,
          void: invoice.status === "void",
        }}
      />
      <p className="text-center text-caption text-muted-foreground print:hidden">
        Questions about this invoice? Reply to the message it came with. Sent with{" "}
        <Link href="/" className="font-medium text-primary hover:underline">
          {PRODUCT_NAME}
        </Link>
        .
      </p>
    </main>
  );
}

/** An issued invoice, shown to its client through a secret link. Nobody needs to sign in. */
export default function Page(props: Props) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-8 sm:py-12 print:block print:bg-white print:p-0">
      <Suspense fallback={<p className="text-muted-foreground">Loading</p>}>
        <InvoicePage {...props} />
      </Suspense>
    </div>
  );
}
