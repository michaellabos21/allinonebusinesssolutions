import type { InvoiceItem } from "@/mocks/types";

/**
 * Invoice arithmetic in integer minor units (centavos). Nothing here uses
 * floating-point money: quantities are whole numbers, and tax is the one
 * division, rounded once to the nearest centavo.
 */

export function lineTotalMinor(item: Pick<InvoiceItem, "quantity" | "unitPriceMinor">) {
  return item.quantity * item.unitPriceMinor;
}

export type InvoiceTotals = {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export function computeInvoiceTotals(
  items: Pick<InvoiceItem, "quantity" | "unitPriceMinor">[],
  discountMinor = 0,
  taxRateBps = 0,
): InvoiceTotals {
  const subtotalMinor = items.reduce((total, item) => total + lineTotalMinor(item), 0);
  // A discount can never take the invoice below zero.
  const discount = Math.min(Math.max(discountMinor, 0), subtotalMinor);
  const taxable = subtotalMinor - discount;
  const taxMinor = Math.round((taxable * taxRateBps) / 10_000);
  return { subtotalMinor, discountMinor: discount, taxMinor, totalMinor: taxable + taxMinor };
}

/** "12%" from 1200 basis points, "12.5%" from 1250. */
export function formatTaxRate(taxRateBps: number) {
  return `${taxRateBps / 100}%`;
}
