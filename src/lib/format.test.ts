import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  describeDue,
  formatAmountInput,
  formatDate,
  formatMoney,
  formatRelativeTime,
  initials,
  parseAmountToMinor,
} from "@/lib/format";

describe("parseAmountToMinor", () => {
  it("reads whole and decimal amounts without floating-point maths", () => {
    expect(parseAmountToMinor("12500")).toBe(1_250_000);
    expect(parseAmountToMinor("12,500.50")).toBe(1_250_050);
    expect(parseAmountToMinor("1.5")).toBe(150);
    expect(parseAmountToMinor("0.07")).toBe(7);
    expect(parseAmountToMinor(" 1 000 ")).toBe(100_000);
  });

  it("rejects anything that is not a plain amount", () => {
    for (const input of ["", "abc", "1.234", "-5", "1e3", "12.", ".5"]) {
      expect(parseAmountToMinor(input), input).toBeNull();
    }
  });
});

describe("formatAmountInput", () => {
  it("round-trips through parseAmountToMinor", () => {
    for (const minor of [0, 7, 150, 1_250_000, 1_250_050]) {
      expect(parseAmountToMinor(formatAmountInput(minor))).toBe(minor);
    }
  });
});

describe("formatMoney", () => {
  it("drops the decimals on whole amounts and keeps them otherwise", () => {
    expect(formatMoney(9_610_000)).toBe("₱96,100");
    expect(formatMoney(4_256_112)).toBe("₱42,561.12");
  });

  it("formats another currency when asked", () => {
    expect(formatMoney(1_234_550, { currency: "USD", locale: "en-US" })).toBe("$12,345.50");
  });
});

describe("dates", () => {
  it("counts whole days between calendar dates", () => {
    expect(daysBetween("2026-09-30", "2026-10-11")).toBe(11);
    expect(daysBetween("2026-10-11", "2026-10-11")).toBe(0);
    expect(daysBetween("2026-10-11", "2026-10-09")).toBe(-2);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-11", 30)).toBe("2026-11-10");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("formats day-first by default", () => {
    expect(formatDate("2026-10-11", "long")).toBe("11 Oct 2026");
  });

  it("describes a due date relative to today", () => {
    expect(describeDue("2026-10-09", "2026-10-11")).toEqual({
      label: "2 days overdue",
      tone: "overdue",
    });
    expect(describeDue("2026-10-10", "2026-10-11")).toEqual({
      label: "1 day overdue",
      tone: "overdue",
    });
    expect(describeDue("2026-10-11", "2026-10-11")).toEqual({ label: "Due today", tone: "today" });
    expect(describeDue("2026-10-12", "2026-10-11")).toEqual({
      label: "Due tomorrow",
      tone: "upcoming",
    });
  });
});

describe("initials", () => {
  it("takes the first letters of the first two words, skipping symbols", () => {
    expect(initials("Mara Dalisay")).toBe("MD");
    expect(initials("Dalisay & Co.")).toBe("DC");
    expect(initials("Tan & Uy Accounting")).toBe("TU");
    expect(initials("verde")).toBe("V");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-11T06:00:00Z");
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

  it("counts minutes, then hours, then days", () => {
    expect(formatRelativeTime(ago(0), now)).toBe("Just now");
    expect(formatRelativeTime(ago(5), now)).toBe("5m ago");
    expect(formatRelativeTime(ago(59), now)).toBe("59m ago");
    expect(formatRelativeTime(ago(60), now)).toBe("1h ago");
    expect(formatRelativeTime(ago(11 * 60 + 59), now)).toBe("11h ago");
    expect(formatRelativeTime(ago(24 * 60), now)).toBe("Yesterday");
    expect(formatRelativeTime(ago(3 * 24 * 60), now)).toBe("3 days ago");
  });

  it("treats a clock a little ahead as just now", () => {
    expect(formatRelativeTime(ago(-2), now)).toBe("Just now");
  });
});
