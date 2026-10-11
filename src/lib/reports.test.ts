import { describe, expect, it } from "vitest";

import {
  getExpenseCategories,
  getHeadline,
  getInvoiceStatusBreakdown,
  getMoneyFlow,
  getRange,
} from "@/lib/reports";
import { expenses, invoices } from "@/mocks";

const TODAY = "2026-10-11";

describe("getRange", () => {
  it("resolves each preset to whole months ending today", () => {
    expect(getRange("this-month", TODAY)).toMatchObject({
      from: "2026-10-01",
      to: TODAY,
      months: ["2026-10"],
    });
    expect(getRange("last-3", TODAY).months).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(getRange("last-6", TODAY).from).toBe("2026-05-01");
    expect(getRange("ytd", TODAY).months).toHaveLength(10);
  });

  it("reaches back across a year boundary", () => {
    expect(getRange("last-3", "2027-01-20").months).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("report figures for the last six months", () => {
  const range = getRange("last-6", TODAY);
  const headline = getHeadline(invoices, expenses, range);

  it("computes the headline figures", () => {
    expect(headline).toEqual({
      collectedMinor: 64_000_000,
      billedMinor: 81_300_000,
      billedCount: 17,
      expenseMinor: 4_440_000,
      netMinor: 59_560_000,
    });
  });

  it("reconciles the monthly breakdown with the headline", () => {
    const flow = getMoneyFlow(invoices, expenses, range);
    expect(flow.reduce((total, month) => total + month.collectedMinor, 0)).toBe(
      headline.collectedMinor,
    );
    expect(flow.reduce((total, month) => total + month.expenseMinor, 0)).toBe(
      headline.expenseMinor,
    );
    expect(flow.at(-1)?.partial).toBe(true);
  });

  it("groups invoices by where they stand today", () => {
    expect(
      getInvoiceStatusBreakdown(invoices, range).map((row) => [
        row.status,
        row.count,
        row.amountMinor,
      ]),
    ).toEqual([
      ["paid", 14, 64_000_000],
      ["sent", 2, 12_800_000],
      ["overdue", 1, 4_500_000],
      ["draft", 1, 2_750_000],
    ]);
  });

  it("totals expenses by category, largest first", () => {
    const categories = getExpenseCategories(expenses, range);
    expect(categories[0]).toEqual({ category: "Software", amountMinor: 2_325_000, count: 8 });
    expect(categories.reduce((total, row) => total + row.amountMinor, 0)).toBe(
      headline.expenseMinor,
    );
  });
});

describe("a narrower range", () => {
  it("only counts records dated inside it", () => {
    const headline = getHeadline(invoices, expenses, getRange("this-month", TODAY));
    expect(headline).toMatchObject({
      collectedMinor: 9_610_000,
      expenseMinor: 1_581_000,
      netMinor: 8_029_000,
    });
  });
});
