import { describe, expect, it } from "vitest";

import {
  computeInvoiceTotals,
  formatQuantity,
  formatTaxRate,
  lineTotalMinor,
  parseQuantityToMilli,
} from "@/lib/money";

describe("lineTotalMinor", () => {
  it("multiplies quantity by unit price in minor units", () => {
    expect(lineTotalMinor({ quantityMilli: 3000, unitPriceMinor: 1_200_000 })).toBe(3_600_000);
    expect(lineTotalMinor({ quantityMilli: 2000, unitPriceMinor: 150_050 })).toBe(300_100);
  });

  it("handles fractional quantities and rounds the line once, half up", () => {
    // 1.5 hours at 1,000.00 is 1,500.00.
    expect(lineTotalMinor({ quantityMilli: 1500, unitPriceMinor: 100_000 })).toBe(150_000);
    // 0.333 × 1.00 is 0.333 → 0.33; 0.335 × 1.00 is 0.335 → 0.34 (half up).
    expect(lineTotalMinor({ quantityMilli: 333, unitPriceMinor: 100 })).toBe(33);
    expect(lineTotalMinor({ quantityMilli: 335, unitPriceMinor: 100 })).toBe(34);
    // 1.001 × 0.01 is 0.01001 → 0.01.
    expect(lineTotalMinor({ quantityMilli: 1001, unitPriceMinor: 1 })).toBe(1);
  });

  it("stays exact for the largest allowed line", () => {
    // 100,000 units at 1,000,000,000.00 each: far beyond floating-point precision.
    expect(lineTotalMinor({ quantityMilli: 100_000_000, unitPriceMinor: 100_000_000_000 })).toBe(
      10_000_000_000_000_000,
    );
  });
});

describe("computeInvoiceTotals", () => {
  const items = [
    { quantityMilli: 3000, unitPriceMinor: 1_200_000 },
    { quantityMilli: 2000, unitPriceMinor: 150_050 },
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

  it("rounds tax once, half up, to the nearest minor unit", () => {
    // 5 centavos at 12.5% is 0.625 centavos → 1.
    const one = [{ quantityMilli: 1000, unitPriceMinor: 5 }];
    expect(computeInvoiceTotals(one, 0, 1250).taxMinor).toBe(1);
    // 3 centavos at 12% is 0.36 → 0.
    expect(
      computeInvoiceTotals([{ quantityMilli: 1000, unitPriceMinor: 3 }], 0, 1200).taxMinor,
    ).toBe(0);
    // 25 centavos at 2% is exactly 0.5 → 1.
    expect(
      computeInvoiceTotals([{ quantityMilli: 1000, unitPriceMinor: 25 }], 0, 200).taxMinor,
    ).toBe(1);
  });

  it("rounds each line before adding, not the sum", () => {
    // Three lines of 0.335 × 1.00: each rounds to 0.34, so 1.02, not round(1.005).
    const lines = Array.from({ length: 3 }, () => ({ quantityMilli: 335, unitPriceMinor: 100 }));
    expect(computeInvoiceTotals(lines).subtotalMinor).toBe(102);
  });

  it("never lets a discount take the invoice below zero", () => {
    const totals = computeInvoiceTotals(
      [{ quantityMilli: 1000, unitPriceMinor: 10_000 }],
      99_999,
      1200,
    );
    expect(totals).toEqual({
      subtotalMinor: 10_000,
      discountMinor: 10_000,
      taxMinor: 0,
      totalMinor: 0,
    });
  });

  it("ignores a negative discount", () => {
    expect(
      computeInvoiceTotals([{ quantityMilli: 1000, unitPriceMinor: 10_000 }], -500).totalMinor,
    ).toBe(10_000);
  });

  it("returns zeros for an invoice with no lines", () => {
    expect(computeInvoiceTotals([], 0, 1200).totalMinor).toBe(0);
  });

  it("only ever produces whole minor units", () => {
    const totals = computeInvoiceTotals([{ quantityMilli: 7333, unitPriceMinor: 33_333 }], 1, 1200);
    for (const value of Object.values(totals)) expect(Number.isInteger(value)).toBe(true);
  });
});

describe("quantities", () => {
  it("formats thousandths without trailing zeros", () => {
    expect(formatQuantity(1500)).toBe("1.5");
    expect(formatQuantity(2000)).toBe("2");
    expect(formatQuantity(1250)).toBe("1.25");
    expect(formatQuantity(1)).toBe("0.001");
  });

  it("parses up to three decimals, and refuses zero, negatives and junk", () => {
    expect(parseQuantityToMilli("1.5")).toBe(1500);
    expect(parseQuantityToMilli("2")).toBe(2000);
    expect(parseQuantityToMilli("0.125")).toBe(125);
    expect(parseQuantityToMilli("1,000")).toBe(1_000_000);
    for (const bad of ["0", "-1", "1.2345", "abc", "", "1e3"]) {
      expect(parseQuantityToMilli(bad), bad).toBeNull();
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
