import { describe, expect, it } from "vitest";

import {
  getExpenseCategories,
  getHeadline,
  getInvoiceStatusBreakdown,
  getMoneyFlow,
  getRange,
  getTaskLoad,
} from "@/lib/reports";
import { expenses, invoices, payments, tasks } from "@/mocks";
import type { Invoice } from "@/mocks";

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
  const headline = getHeadline(invoices, payments, expenses, range);

  it("computes the headline figures", () => {
    expect(headline).toEqual({
      invoicedMinor: 81_300_000,
      invoicedCount: 17,
      collectedMinor: 64_000_000,
      outstandingMinor: 17_300_000,
      outstandingCount: 3,
      expenseMinor: 4_440_000,
    });
  });

  it("reconciles the monthly breakdown with the headline", () => {
    const flow = getMoneyFlow(payments, expenses, range);
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
      ["partially_paid", 0, 0],
      ["sent", 2, 12_800_000],
      ["overdue", 1, 4_500_000],
      ["void", 0, 0],
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
    const headline = getHeadline(invoices, payments, expenses, getRange("this-month", TODAY));
    expect(headline).toMatchObject({ collectedMinor: 9_610_000, expenseMinor: 1_581_000 });
  });
});

describe("part payments, voids and archived expenses", () => {
  const range = getRange("this-month", TODAY);
  const base = invoices.find((invoice) => invoice.status === "sent")!;
  const partPaid: Invoice = {
    ...base,
    id: "part",
    status: "partially_paid",
    issuedOn: "2026-10-02",
    dueOn: "2026-10-30",
    amountMinor: 100_000,
    paidMinor: 40_000,
  };
  const voided: Invoice = {
    ...base,
    id: "void",
    status: "void",
    issuedOn: "2026-10-03",
    amountMinor: 999,
  };
  const headline = getHeadline(
    [partPaid, voided],
    [
      {
        id: "p",
        invoiceId: "part",
        amountMinor: 40_000,
        paidOn: "2026-10-05",
        method: "cash",
        reference: "",
        note: "",
      },
    ],
    [{ ...expenses[0], archived: true }],
    range,
  );

  it("counts what is still owed, leaves voids out of invoiced, and skips archived expenses", () => {
    expect(headline).toEqual({
      invoicedMinor: 100_000,
      invoicedCount: 1,
      collectedMinor: 40_000,
      outstandingMinor: 60_000,
      outstandingCount: 1,
      expenseMinor: 0,
    });
  });

  it("reconciles: invoiced = collected on these invoices + still owed", () => {
    expect(headline.invoicedMinor).toBe(headline.collectedMinor + headline.outstandingMinor);
  });
});

describe("getTaskLoad with several assignees", () => {
  it("counts a shared task for each assignee and skips unassigned or undated ones", () => {
    const range = getRange("this-month", "2026-10-11");
    const base = tasks[0];
    const load = getTaskLoad(
      [
        { ...base, id: "a", dueOn: "2026-10-05", status: "done", assigneeIds: ["mia", "leo"] },
        { ...base, id: "b", dueOn: "2026-10-09", status: "todo", assigneeIds: ["mia"] },
        { ...base, id: "c", dueOn: "2026-10-09", status: "todo", assigneeIds: [] },
        { ...base, id: "d", dueOn: null, status: "todo", assigneeIds: ["leo"] },
      ],
      range,
    );
    const byId = Object.fromEntries(load.map((row) => [row.id, row]));
    expect(byId.mia).toMatchObject({ done: 1, open: 1, overdue: 1 });
    expect(byId.leo).toMatchObject({ done: 1, open: 0, overdue: 0 });
    expect(load).toHaveLength(2);
  });
});
