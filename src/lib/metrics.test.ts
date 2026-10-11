import { describe, expect, it } from "vitest";

import {
  getOpenDeals,
  getOpenInvoices,
  getPipeline,
  getRevenueByMonth,
  getSummary,
  invoiceDisplayStatus,
} from "@/lib/metrics";
import { deals, invoices, projects, tasks } from "@/mocks";

/** The demo records double as fixtures: these are the figures the UI was reviewed against. */
const TODAY = "2026-10-11";

describe("invoiceDisplayStatus", () => {
  const sent = invoices.find((invoice) => invoice.number === "INV-1037")!;

  it("derives overdue from a sent invoice's due date", () => {
    expect(invoiceDisplayStatus(sent, "2026-09-30")).toBe("sent");
    expect(invoiceDisplayStatus(sent, "2026-10-01")).toBe("overdue");
  });

  it("never marks a draft or paid invoice overdue", () => {
    const paid = invoices.find((invoice) => invoice.status === "paid")!;
    const draft = invoices.find((invoice) => invoice.status === "draft")!;
    expect(invoiceDisplayStatus(paid, "2030-01-01")).toBe("paid");
    expect(invoiceDisplayStatus(draft, "2030-01-01")).toBe("draft");
  });
});

describe("getRevenueByMonth", () => {
  it("totals payments by the month they were received", () => {
    const months = getRevenueByMonth(invoices, 6, TODAY);
    expect(months.map((month) => month.totalMinor)).toEqual([
      8_300_000, 9_050_000, 11_640_000, 10_750_000, 14_650_000, 9_610_000,
    ]);
    expect(months.at(-1)).toMatchObject({ key: "2026-10", partial: true, invoiceCount: 2 });
  });

  it("crosses a year boundary", () => {
    expect(getRevenueByMonth([], 3, "2027-01-15").map((month) => month.key)).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });
});

describe("getSummary", () => {
  const summary = getSummary({ invoices, projects, tasks }, TODAY, TODAY);

  it("reports collected, open and overdue invoice money", () => {
    expect(summary).toMatchObject({
      collectedThisMonthMinor: 9_610_000,
      collectedPreviousMonthMinor: 14_650_000,
      openInvoiceMinor: 17_300_000,
      openInvoiceCount: 3,
      overdueInvoiceMinor: 4_500_000,
      overdueInvoiceCount: 1,
    });
  });

  it("counts active projects and tasks due", () => {
    expect(summary).toMatchObject({
      activeProjectCount: 4,
      projectsDueSoonCount: 2,
      tasksDueThisWeekCount: 5,
      overdueTaskCount: 2,
    });
  });

  it("agrees with the open invoice list", () => {
    const open = getOpenInvoices(invoices);
    expect(open).toHaveLength(summary.openInvoiceCount);
    expect(open.reduce((total, invoice) => total + invoice.amountMinor, 0)).toBe(
      summary.openInvoiceMinor,
    );
  });
});

describe("pipeline", () => {
  it("counts only deals that are still open", () => {
    expect(getOpenDeals(deals)).toHaveLength(7);
    expect(getOpenDeals(deals.map((deal) => ({ ...deal, archived: true })))).toHaveLength(0);
  });

  it("totals value by stage", () => {
    const stages = getPipeline(deals);
    expect(stages.map((stage) => [stage.id, stage.dealCount, stage.valueMinor])).toEqual([
      ["lead", 2, 6_400_000],
      ["qualified", 2, 21_500_000],
      ["proposal", 2, 32_400_000],
      ["negotiation", 1, 24_000_000],
    ]);
  });
});
