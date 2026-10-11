/**
 * Document arithmetic in integer minor units (centavos). Nothing here uses
 * floating-point money. Quantities are thousandths of a unit (1.5 hours is
 * 1500), so fractional quantities stay exact.
 *
 * The database computes the stored totals with the same rules (see
 * `supabase/migrations/20261011000004_finance.sql`); this copy is for previews
 * while editing, and the integration tests check that the two agree:
 *
 *   1. Each line is quantity × unit price, rounded once, half up.
 *   2. The subtotal is the sum of the lines.
 *   3. The discount comes off the subtotal, and never takes it below zero.
 *   4. Tax is charged on what is left, rounded once, half up.
 */

export type LineInput = { quantityMilli: number; unitPriceMinor: number };

// BigInt(…) rather than literals like 2n: the TypeScript target predates them.
const TWO = BigInt(2);
const ZERO = BigInt(0);
const THOUSAND = BigInt(1000);
const TEN_THOUSAND = BigInt(10_000);

/** Integer division of non-negative BigInts, rounding half up. */
const divideRounded = (numerator: bigint, denominator: bigint) =>
  (numerator * TWO + denominator) / (denominator * TWO);

export function lineTotalMinor({ quantityMilli, unitPriceMinor }: LineInput) {
  return Number(divideRounded(BigInt(quantityMilli) * BigInt(unitPriceMinor), THOUSAND));
}

export type InvoiceTotals = {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export function computeInvoiceTotals(
  items: LineInput[],
  discountMinor = 0,
  taxRateBps = 0,
): InvoiceTotals {
  const subtotal = items.reduce((total, item) => total + BigInt(lineTotalMinor(item)), ZERO);
  const discount = BigInt(Math.min(Math.max(discountMinor, 0), Number(subtotal)));
  const taxable = subtotal - discount;
  const tax = divideRounded(taxable * BigInt(taxRateBps), TEN_THOUSAND);
  return {
    subtotalMinor: Number(subtotal),
    discountMinor: Number(discount),
    taxMinor: Number(tax),
    totalMinor: Number(taxable + tax),
  };
}

/** "12%" from 1200 basis points, "12.5%" from 1250. */
export function formatTaxRate(taxRateBps: number) {
  return `${taxRateBps / 100}%`;
}

/** 1500 -> "1.5", 2000 -> "2", 1250 -> "1.25". */
export function formatQuantity(quantityMilli: number) {
  const whole = Math.trunc(quantityMilli / 1000);
  const fraction = String(quantityMilli % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

/** "1.5" -> 1500. Up to three decimals; null for anything else or for zero. */
export function parseQuantityToMilli(input: string): number | null {
  const match = /^(\d{1,6})(?:\.(\d{1,3}))?$/.exec(input.trim().replace(/,/g, ""));
  if (!match) return null;
  const milli = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
  return milli > 0 && milli <= 100_000_000 ? milli : null;
}
