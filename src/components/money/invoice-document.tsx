import { PRODUCT_NAME } from "@/config/app";
import { formatDate, formatMoney } from "@/lib/format";
import { computeInvoiceTotals, formatTaxRate, lineTotalMinor } from "@/lib/money";
import type { Invoice } from "@/mocks";

/**
 * The invoice as the client would read it: who it is from and to, the lines,
 * and how the total is reached. Totals are recomputed from the lines here, so
 * the document can never disagree with them.
 */
export function InvoiceDocument({
  invoice,
  workspaceName,
  billTo,
}: {
  invoice: Invoice;
  workspaceName: string;
  billTo: { name: string; company: string; email: string };
}) {
  const totals = computeInvoiceTotals(invoice.items, invoice.discountMinor, invoice.taxRateBps);

  return (
    <article aria-label={`Invoice ${invoice.number}`} className="min-w-0 rounded-lg border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5 sm:px-8 sm:py-6">
        <div>
          <p className="font-display text-lg font-semibold">{workspaceName}</p>
          <p className="text-caption text-muted-foreground">Issued with {PRODUCT_NAME}</p>
        </div>
        <div className="text-right">
          <p className="text-caption text-muted-foreground">Invoice</p>
          <p className="tabular font-display text-title">{invoice.number}</p>
        </div>
      </header>

      <dl className="grid gap-x-8 gap-y-4 border-b px-5 py-5 sm:grid-cols-3 sm:px-8">
        <div>
          <dt className="text-caption text-muted-foreground">Billed to</dt>
          <dd className="mt-0.5">
            <span className="block font-medium">{billTo.company || billTo.name}</span>
            {billTo.company ? <span className="block">{billTo.name}</span> : null}
            <span className="block break-words text-muted-foreground">{billTo.email}</span>
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Issued</dt>
          <dd className="tabular mt-0.5">{formatDate(invoice.issuedOn, "long")}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Due</dt>
          <dd className="tabular mt-0.5">{formatDate(invoice.dueOn, "long")}</dd>
        </div>
      </dl>

      <div className="relative overflow-x-auto px-5 sm:px-8">
        <table className="w-full min-w-[26rem] border-collapse text-left">
          <caption className="sr-only">Invoice lines</caption>
          <thead>
            <tr className="border-b text-xs font-medium text-muted-foreground">
              <th scope="col" className="py-2.5 pr-4 font-medium">Description</th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium">Qty</th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium">Unit price</th>
              <th scope="col" className="py-2.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-dashed last:border-solid">
                <td className="py-3 pr-4">{item.description}</td>
                <td className="tabular py-3 pr-4 text-right">{item.quantity}</td>
                <td className="tabular py-3 pr-4 text-right whitespace-nowrap">{formatMoney(item.unitPriceMinor)}</td>
                <td className="tabular py-3 text-right whitespace-nowrap">{formatMoney(lineTotalMinor(item))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end px-5 py-5 sm:px-8">
        <dl className="w-full max-w-xs space-y-1.5">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular">{formatMoney(totals.subtotalMinor)}</dd>
          </div>
          {totals.discountMinor > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular">−{formatMoney(totals.discountMinor)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">
              {invoice.taxRateBps > 0 ? `Tax (${formatTaxRate(invoice.taxRateBps)})` : "Tax"}
            </dt>
            <dd className="tabular">{invoice.taxRateBps > 0 ? formatMoney(totals.taxMinor) : "None"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t pt-2.5">
            <dt className="font-medium">Total due</dt>
            <dd className="font-display text-figure">{formatMoney(totals.totalMinor)}</dd>
          </div>
        </dl>
      </div>

      {invoice.notes ? (
        <footer className="border-t px-5 py-4 sm:px-8">
          <p className="text-caption text-muted-foreground">Notes</p>
          <p className="mt-0.5 max-w-[70ch] whitespace-pre-wrap">{invoice.notes}</p>
        </footer>
      ) : null}
    </article>
  );
}
