"use client";

import { Plus, ReceiptText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { BackLink, MissingRecord } from "@/components/crm/shared";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DEMO_TODAY, TAX_OPTIONS } from "@/config/app";
import { addDays, formatAmountInput, formatMoney, parseAmountToMinor } from "@/lib/format";
import { computeInvoiceTotals, formatTaxRate } from "@/lib/money";
import { getRuntime } from "@/lib/runtime";
import type { Invoice } from "@/mocks";

type Row = { key: number; description: string; quantity: string; unitPrice: string };
type Errors = Record<string, string>;

const QUANTITY_PATTERN = /^[1-9]\d{0,5}$/;

/** Reads a row as numbers, or null where the text is not yet valid. */
function parseRow(row: Row) {
  const quantity = QUANTITY_PATTERN.test(row.quantity.trim()) ? Number(row.quantity.trim()) : null;
  const unitPriceMinor = parseAmountToMinor(row.unitPrice);
  return {
    quantity,
    unitPriceMinor: unitPriceMinor !== null && unitPriceMinor > 0 ? unitPriceMinor : null,
  };
}

/** Route entry for editing: resolves the draft from the URL. */
export function InvoiceEditRoute() {
  const { id } = useParams<{ id: string }>();
  const { invoices } = useDemoStore();
  const invoice = invoices.find((item) => item.id === id);

  if (!invoice) {
    return (
      <MissingRecord
        icon={ReceiptText}
        noun="invoice"
        listHref="/money/invoices"
        listLabel="Back to invoices"
      />
    );
  }
  if (invoice.status !== "draft") {
    return (
      <div className="page-container">
        <EmptyState
          icon={ReceiptText}
          title={`${invoice.number} can’t be edited`}
          description="Only drafts can be changed. Once an invoice is sent, its lines and total are locked."
          action={
            <Button asChild variant="outline">
              <Link href={`/money/invoices/${invoice.id}`}>View invoice</Link>
            </Button>
          }
          className="py-20"
        />
      </div>
    );
  }
  return <InvoiceEditor invoice={invoice} />;
}

/** Full invoice form with line items and live totals. Saves a draft to session state. */
export function InvoiceEditor({ invoice }: { invoice?: Invoice }) {
  const router = useRouter();
  const store = useDemoStore();
  const nextKey = useRef(invoice?.items.length ?? 1);

  const [contactId, setContactId] = useState(invoice?.contactId ?? "");
  const [issuedOn, setIssuedOn] = useState(invoice?.issuedOn ?? DEMO_TODAY);
  const [dueOn, setDueOn] = useState(
    invoice?.dueOn ?? addDays(DEMO_TODAY, getRuntime().paymentTermDays),
  );
  const [rows, setRows] = useState<Row[]>(
    invoice?.items.map((item, index) => ({
      key: index,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: formatAmountInput(item.unitPriceMinor),
    })) ?? [{ key: 0, description: "", quantity: "1", unitPrice: "" }],
  );
  const [discount, setDiscount] = useState(
    invoice?.discountMinor ? formatAmountInput(invoice.discountMinor) : "",
  );
  const [taxRateBps, setTaxRateBps] = useState(
    String(invoice?.taxRateBps ?? getRuntime().taxRateBps),
  );
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [errors, setErrors] = useState<Errors>({});

  const contacts = store.contacts.filter(
    (contact) => !contact.archived || contact.id === invoice?.contactId,
  );
  const catalog = store.catalog.filter((item) => !item.archived);

  // Live totals use whatever parses so far; unfinished rows count as zero.
  const parsed = rows.map(parseRow);
  const discountMinor = discount.trim() ? (parseAmountToMinor(discount) ?? 0) : 0;
  const totals = computeInvoiceTotals(
    parsed.map((row) => ({ quantity: row.quantity ?? 0, unitPriceMinor: row.unitPriceMinor ?? 0 })),
    discountMinor,
    Number(taxRateBps),
  );

  const clearError = (name: string) => {
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
  };
  const updateRow = (key: number, patch: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    clearError(`row-${key}`);
    clearError("items");
  };
  const addRow = (row: Omit<Row, "key"> = { description: "", quantity: "1", unitPrice: "" }) => {
    nextKey.current += 1;
    setRows((current) => [...current, { key: nextKey.current, ...row }]);
    clearError("items");
  };

  function addFromCatalog(id: string) {
    const item = catalog.find((entry) => entry.id === id);
    if (!item) return;
    const filled = {
      description: item.name,
      quantity: "1",
      unitPrice: formatAmountInput(item.unitPriceMinor),
    };
    // Reuse a single untouched first row instead of leaving it blank above the new one.
    const [only] = rows;
    if (rows.length === 1 && !only.description.trim() && !only.unitPrice.trim())
      updateRow(only.key, filled);
    else addRow(filled);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found: Errors = {};
    if (!contactId) found.contactId = "Choose a client to bill.";
    if (!issuedOn) found.issuedOn = "Choose an issue date.";
    if (!dueOn) found.dueOn = "Choose a due date.";
    else if (issuedOn && dueOn < issuedOn)
      found.dueOn = "The due date can’t be before the issue date.";

    rows.forEach((row, index) => {
      const numbers = parsed[index];
      if (!row.description.trim()) found[`row-${row.key}`] = "Describe this line.";
      else if (numbers.quantity === null)
        found[`row-${row.key}`] = "Quantity must be a whole number, 1 or more.";
      else if (numbers.unitPriceMinor === null)
        found[`row-${row.key}`] = "Enter a unit price above zero, like 2500 or 2,500.50.";
    });
    if (rows.length === 0) found.items = "Add at least one line.";

    if (discount.trim()) {
      const value = parseAmountToMinor(discount);
      if (value === null) found.discount = "Enter the discount as an amount, like 1000.";
      else if (value > totals.subtotalMinor)
        found.discount = "The discount can’t be more than the subtotal.";
    }

    setErrors(found);
    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid) {
      document.getElementById(`invoice-${firstInvalid}`)?.focus();
      return;
    }

    const saved = store.saveInvoice(
      {
        contactId,
        issuedOn,
        dueOn,
        items: rows.map((row, index) => ({
          description: row.description.trim(),
          quantity: parsed[index].quantity ?? 1,
          unitPriceMinor: parsed[index].unitPriceMinor ?? 0,
        })),
        discountMinor,
        taxRateBps: Number(taxRateBps),
        notes: notes.trim(),
      },
      invoice?.id,
    );
    toast.success(invoice ? `Draft ${saved.number} updated` : `Draft ${saved.number} saved`, {
      description: "Kept for this session only. Nothing was sent.",
    });
    router.push(`/money/invoices/${saved.id}`);
  }

  const backHref = invoice ? `/money/invoices/${invoice.id}` : "/money/invoices";
  const errorId = (name: string) => (errors[name] ? `invoice-${name}-error` : undefined);
  const fieldError = (name: string) =>
    errors[name] ? (
      <p id={`invoice-${name}-error`} className="text-caption text-danger">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="page-container space-y-6">
      <BackLink href={backHref} label={invoice ? invoice.number : "Invoices"} />
      <PageHeader
        title={invoice ? `Edit ${invoice.number}` : "New invoice"}
        description="Saved as a draft. Nothing is sent to the client until you mark it as sent, and that step is simulated too."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section
            aria-labelledby="invoice-details-title"
            className="rounded-lg border bg-card px-5 py-5"
          >
            <h2 id="invoice-details-title" className="text-section">
              Details
            </h2>
            {contacts.length === 0 ? (
              <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-caption text-warning">
                Add a contact first. An invoice needs a client to bill.
              </p>
            ) : null}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="grid content-start gap-1.5 sm:col-span-2">
                <Label htmlFor="invoice-contactId">Client</Label>
                <Select
                  value={contactId}
                  onValueChange={(value) => {
                    setContactId(value);
                    clearError("contactId");
                  }}
                >
                  <SelectTrigger
                    id="invoice-contactId"
                    className="w-full"
                    aria-invalid={Boolean(errors.contactId)}
                    aria-describedby={errorId("contactId")}
                  >
                    <SelectValue placeholder="Choose a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => {
                      const company = store.companyName(contact.companyId);
                      return (
                        <SelectItem key={contact.id} value={contact.id}>
                          {company ? `${company}, ${contact.name}` : contact.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {fieldError("contactId")}
              </div>
              <div className="grid content-start gap-1.5">
                <Label htmlFor="invoice-issuedOn">Issue date</Label>
                <Input
                  id="invoice-issuedOn"
                  type="date"
                  value={issuedOn}
                  onChange={(event) => {
                    setIssuedOn(event.target.value);
                    clearError("issuedOn");
                  }}
                  aria-invalid={Boolean(errors.issuedOn)}
                  aria-describedby={errorId("issuedOn")}
                />
                {fieldError("issuedOn")}
              </div>
              <div className="grid content-start gap-1.5">
                <Label htmlFor="invoice-dueOn">Due date</Label>
                <Input
                  id="invoice-dueOn"
                  type="date"
                  value={dueOn}
                  onChange={(event) => {
                    setDueOn(event.target.value);
                    clearError("dueOn");
                  }}
                  aria-invalid={Boolean(errors.dueOn)}
                  aria-describedby={errorId("dueOn")}
                />
                {fieldError("dueOn")}
              </div>
            </div>
          </section>

          <section
            aria-labelledby="invoice-lines-title"
            className="rounded-lg border bg-card px-5 py-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="invoice-lines-title" className="text-section">
                Lines
              </h2>
              {catalog.length > 0 ? (
                <Select value="" onValueChange={addFromCatalog}>
                  <SelectTrigger className="w-56" aria-label="Add a line from the catalog">
                    <SelectValue placeholder="Add from catalog" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}, {formatMoney(item.unitPriceMinor)} per {item.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>

            <ul className="mt-4 space-y-4">
              {rows.map((row, index) => {
                const numbers = parsed[index];
                const lineMinor = (numbers.quantity ?? 0) * (numbers.unitPriceMinor ?? 0);
                const rowError = errors[`row-${row.key}`];
                const describedBy = rowError ? `invoice-row-${row.key}-error` : undefined;
                return (
                  <li
                    key={row.key}
                    className="border-b border-dashed pb-4 last:border-b-0 last:pb-0"
                  >
                    <fieldset className="grid grid-cols-[1fr_1fr_auto] items-end gap-x-3 gap-y-2 md:grid-cols-[minmax(0,1fr)_5rem_8rem_7rem_auto]">
                      <legend className="sr-only">Line {index + 1}</legend>
                      <div className="col-span-3 grid gap-1.5 md:col-span-1">
                        <Label htmlFor={`invoice-row-${row.key}`}>Description</Label>
                        <Input
                          id={`invoice-row-${row.key}`}
                          value={row.description}
                          placeholder="What you are billing for"
                          autoComplete="off"
                          onChange={(event) =>
                            updateRow(row.key, { description: event.target.value })
                          }
                          aria-invalid={Boolean(rowError)}
                          aria-describedby={describedBy}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`invoice-qty-${row.key}`}>Qty</Label>
                        <Input
                          id={`invoice-qty-${row.key}`}
                          inputMode="numeric"
                          value={row.quantity}
                          autoComplete="off"
                          className="tabular text-right"
                          onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                          aria-describedby={describedBy}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`invoice-price-${row.key}`}>Unit price</Label>
                        <Input
                          id={`invoice-price-${row.key}`}
                          inputMode="decimal"
                          value={row.unitPrice}
                          placeholder="0"
                          autoComplete="off"
                          className="tabular text-right"
                          onChange={(event) =>
                            updateRow(row.key, { unitPrice: event.target.value })
                          }
                          aria-describedby={describedBy}
                        />
                      </div>
                      <div className="col-span-2 flex h-8 items-center justify-between gap-2 md:col-span-1 md:justify-end">
                        <span className="text-caption text-muted-foreground md:sr-only">
                          Line total
                        </span>
                        <span className="tabular font-medium">{formatMoney(lineMinor)}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove line ${index + 1}`}
                        disabled={rows.length === 1}
                        onClick={() => {
                          setRows((current) => current.filter((item) => item.key !== row.key));
                          clearError(`row-${row.key}`);
                        }}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </fieldset>
                    {rowError ? (
                      <p
                        id={`invoice-row-${row.key}-error`}
                        className="mt-1.5 text-caption text-danger"
                      >
                        {rowError}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <Button type="button" variant="outline" className="mt-4" onClick={() => addRow()}>
              <Plus data-icon="inline-start" aria-hidden />
              Add line
            </Button>
            {fieldError("items")}
            <p className="mt-3 text-xs text-muted-foreground">
              Quantities are whole numbers in this prototype. Prices are in {getRuntime().currency}.
            </p>
          </section>

          <section
            aria-labelledby="invoice-notes-title"
            className="rounded-lg border bg-card px-5 py-5"
          >
            <h2 id="invoice-notes-title" className="text-section">
              Notes
            </h2>
            <Label htmlFor="invoice-notes" className="sr-only">
              Notes shown on the invoice
            </Label>
            <Textarea
              id="invoice-notes"
              rows={3}
              className="mt-3"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Payment instructions or a thank-you, shown at the bottom of the invoice."
            />
          </section>
        </div>

        <aside
          aria-label="Totals"
          className="self-start rounded-lg border bg-card px-5 py-5 xl:sticky xl:top-6"
        >
          <h2 className="text-section">Totals</h2>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="invoice-discount">
                Discount ({getRuntime().currency})
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="invoice-discount"
                inputMode="decimal"
                value={discount}
                placeholder="0"
                autoComplete="off"
                className="tabular"
                onChange={(event) => {
                  setDiscount(event.target.value);
                  clearError("discount");
                }}
                aria-invalid={Boolean(errors.discount)}
                aria-describedby={errorId("discount")}
              />
              {fieldError("discount")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invoice-tax">Tax</Label>
              <Select value={taxRateBps} onValueChange={setTaxRateBps}>
                <SelectTrigger
                  id="invoice-tax"
                  className="w-full"
                  aria-describedby="invoice-tax-hint"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_OPTIONS.map((option) => (
                    <SelectItem key={option.bps} value={String(option.bps)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p id="invoice-tax-hint" className="text-xs text-muted-foreground">
                Demo rates only, not tax advice. Tax applies after the discount.
              </p>
            </div>
          </div>

          <dl className="mt-5 space-y-1.5 border-t pt-4" aria-live="polite">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular">{formatMoney(totals.subtotalMinor)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular">
                {totals.discountMinor > 0 ? `−${formatMoney(totals.discountMinor)}` : "None"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                {Number(taxRateBps) > 0 ? `Tax (${formatTaxRate(Number(taxRateBps))})` : "Tax"}
              </dt>
              <dd className="tabular">
                {Number(taxRateBps) > 0 ? formatMoney(totals.taxMinor) : "None"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t pt-2.5">
              <dt className="font-medium">Total</dt>
              <dd className="font-display text-figure">{formatMoney(totals.totalMinor)}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="submit" className="hover:bg-primary-hover">
              {invoice ? "Save changes" : "Save draft"}
            </Button>
            <Button asChild variant="outline">
              <Link href={backHref}>Cancel</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Sample data: kept until you reload.</p>
        </aside>
      </div>
    </form>
  );
}
