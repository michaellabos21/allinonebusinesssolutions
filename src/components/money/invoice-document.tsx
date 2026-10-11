import { formatDate, formatMoney } from "@/lib/format";
import { splitLineText } from "@/lib/document-lines";
import { formatQuantity, formatTaxRate } from "@/lib/money";
import type { BillTo, InvoiceItem } from "@/mocks";

export type DocumentView = {
  kind: "Invoice" | "Estimate";
  /** Null for a draft, which has no number yet. */
  number: string | null;
  currency: string;
  issuedOn: string;
  /** Due date for an invoice, "valid until" for an estimate. */
  endsOn: string;
  items: InvoiceItem[];
  subtotalMinor: number;
  discountMinor: number;
  taxRateBps: number;
  taxMinor: number;
  totalMinor: number;
  /** Invoices only: what has been recorded as paid. */
  paidMinor?: number;
  notes: string;
  void?: boolean;
};

/**
 * An invoice or estimate as the client reads it, and as it prints. Every
 * figure shown is the one the database stored, so the printed or saved PDF
 * always matches the record. Nothing is recalculated here.
 */
export function InvoiceDocument({
  doc,
  workspaceName,
  billTo,
}: {
  doc: DocumentView;
  workspaceName: string;
  billTo: BillTo | null;
}) {
  const money = (amount: number) => formatMoney(amount, { currency: doc.currency });
  const balance = doc.paidMinor !== undefined ? doc.totalMinor - doc.paidMinor : null;

  return (
    <article
      data-printable
      aria-label={`${doc.kind} ${doc.number ?? "draft"}`}
      className="relative min-w-0 rounded-lg border bg-card"
    >
      {doc.void ? (
        <p
          aria-hidden
          className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -rotate-12 rounded border-4 border-danger/60 px-4 py-1 font-display text-4xl font-bold text-danger/60"
        >
          VOID
        </p>
      ) : null}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5 sm:px-8 sm:py-6">
        <p className="font-display text-lg font-semibold">{workspaceName}</p>
        <div className="text-right">
          <p className="text-caption text-muted-foreground">{doc.kind}</p>
          <p className="tabular font-display text-title">{doc.number ?? "Draft"}</p>
        </div>
      </header>

      <dl className="grid gap-x-8 gap-y-4 border-b px-5 py-5 sm:grid-cols-3 sm:px-8">
        <div>
          <dt className="text-caption text-muted-foreground">
            {doc.kind === "Invoice" ? "Billed to" : "Prepared for"}
          </dt>
          <dd className="mt-0.5">
            {billTo ? (
              <>
                <span className="block font-medium">{billTo.company || billTo.name}</span>
                {billTo.company ? <span className="block">{billTo.name}</span> : null}
                <span className="block break-words text-muted-foreground">{billTo.email}</span>
                {billTo.address ? (
                  <span className="block whitespace-pre-wrap text-muted-foreground">
                    {billTo.address}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">No client chosen yet</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Issued</dt>
          <dd className="tabular mt-0.5">{formatDate(doc.issuedOn, "long")}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">
            {doc.kind === "Invoice" ? "Due" : "Valid until"}
          </dt>
          <dd className="tabular mt-0.5">{formatDate(doc.endsOn, "long")}</dd>
        </div>
      </dl>

      <div className="relative overflow-x-auto px-5 sm:px-8">
        <table className="w-full min-w-[26rem] border-collapse text-left">
          <caption className="sr-only">{doc.kind} lines</caption>
          <thead>
            <tr className="border-b text-xs font-medium text-muted-foreground">
              <th scope="col" className="py-2.5 pr-4 font-medium">
                Description
              </th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                Qty
              </th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                Unit price
              </th>
              <th scope="col" className="py-2.5 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item) => {
              const { name, details } = splitLineText(item.description);
              return (
                <tr key={item.id} className="border-b border-dashed last:border-solid">
                  <td className="py-3 pr-4 align-top">
                    <span className="block">{name}</span>
                    {details ? (
                      <span className="mt-0.5 block max-w-[52ch] text-caption whitespace-pre-wrap text-muted-foreground">
                        {details}
                      </span>
                    ) : null}
                  </td>
                  <td className="tabular py-3 pr-4 text-right align-top">
                    {formatQuantity(item.quantityMilli)}
                  </td>
                  <td className="tabular py-3 pr-4 text-right align-top whitespace-nowrap">
                    {money(item.unitPriceMinor)}
                  </td>
                  <td className="tabular py-3 text-right align-top whitespace-nowrap">
                    {money(item.amountMinor)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end px-5 py-5 sm:px-8">
        <dl className="w-full max-w-xs space-y-1.5">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular">{money(doc.subtotalMinor)}</dd>
          </div>
          {doc.discountMinor > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular">−{money(doc.discountMinor)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">
              {doc.taxRateBps > 0 ? `Tax (${formatTaxRate(doc.taxRateBps)})` : "Tax"}
            </dt>
            <dd className="tabular">{doc.taxRateBps > 0 ? money(doc.taxMinor) : "None"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t pt-2.5">
            <dt className="font-medium">Total</dt>
            <dd className="font-display text-figure">{money(doc.totalMinor)}</dd>
          </div>
          {balance !== null && doc.paidMinor! > 0 ? (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="tabular">−{money(doc.paidMinor!)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t pt-2.5">
                <dt className="font-medium">Balance due</dt>
                <dd className="font-display text-figure">{money(balance)}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </div>

      {doc.notes ? (
        <footer className="border-t px-5 py-4 sm:px-8">
          <p className="text-caption text-muted-foreground">Notes</p>
          <p className="mt-0.5 max-w-[70ch] whitespace-pre-wrap">{doc.notes}</p>
        </footer>
      ) : null}
    </article>
  );
}
