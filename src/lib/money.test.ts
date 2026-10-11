import { describe, expect, it } from "vitest";

import { computeInvoiceTotals, formatTaxRate, lineTotalMinor } from "@/lib/money";
import { invoices } from "@/mocks";

describe("lineTotalMinor", () => {
  it("multiplies quantity by unit price in minor units", () => {
    expect(lineTotalMinor({ quantity: 3, unitPriceMinor: 1_200_000 })).toBe(3_600_000);
    expect(lineTotalMinor({ quantity: 2, unitPriceMinor: 150_050 })).toBe(300_100);
  });
});

describe("computeInvoiceTotals", () => {
  const items = [
    { quantity: 3, unitPriceMinor: 1_200_000 },
    { quantity: 2, unitPriceMinor: 150_050 },
  ];

  it("sums lines with no discount or tax", () => {
    expect(computeInvoiceTotals(items)).toEqual({
      subtotalMinor: 3_900_100,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 3_900_100,
    });
  });

  it("applies the discount before tax", () => {
    expect(computeInvoiceTotals(items, 100_000, 1200)).toEqual({
      subtotalMinor: 3_900_100,
      discountMinor: 100_000,
      taxMinor: 456_012,
      totalMinor: 4_256_112,
    });
  });

  it("rounds tax once, to the nearest minor unit", () => {
    // 5 centavos at 12.5% is 0.625 centavos, which rounds up to 1.
    expect(computeInvoiceTotals([{ quantity: 1, unitPriceMinor: 5 }], 0, 1250).taxMinor).toBe(1);
    // 3 centavos at 12% is 0.36 centavos, which rounds down to 0.
    expect(computeInvoiceTotals([{ quantity: 1, unitPriceMinor: 3 }], 0, 1200).taxMinor).toBe(0);
  });

  it("never lets a discount take the invoice below zero", () => {
    const totals = computeInvoiceTotals([{ quantity: 1, unitPriceMinor: 10_000 }], 99_999, 1200);
    expect(totals).toEqual({
      subtotalMinor: 10_000,
      discountMinor: 10_000,
      taxMinor: 0,
      totalMinor: 0,
    });
  });

  it("ignores a negative discount", () => {
    expect(computeInvoiceTotals([{ quantity: 1, unitPriceMinor: 10_000 }], -500).totalMinor).toBe(
      10_000,
    );
  });

  it("returns zeros for an invoice with no lines", () => {
    expect(computeInvoiceTotals([], 0, 1200).totalMinor).toBe(0);
  });

  it("only ever produces whole minor units", () => {
    const totals = computeInvoiceTotals([{ quantity: 7, unitPriceMinor: 33_333 }], 1, 1200);
    for (const value of Object.values(totals)) expect(Number.isInteger(value)).toBe(true);
  });
});

describe("demo invoices", () => {
  it("store a total that matches their lines", () => {
    for (const invoice of invoices) {
      const totals = computeInvoiceTotals(invoice.items, invoice.discountMinor, invoice.taxRateBps);
      expect(invoice.amountMinor, invoice.number).toBe(totals.totalMinor);
    }
  });
});

describe("formatTaxRate", () => {
  it("writes basis points as a percentage", () => {
    expect(formatTaxRate(1200)).toBe("12%");
    expect(formatTaxRate(1250)).toBe("12.5%");
    expect(formatTaxRate(0)).toBe("0%");
  });
});
