import { describe, expect, it } from "vitest";

import { getMonthGrid, getProjectProgress, shiftMonth, sortTasksForList } from "@/lib/work";
import { tasks } from "@/mocks";

describe("getProjectProgress", () => {
  it("counts done, open and overdue tasks for one project", () => {
    expect(getProjectProgress("p1", tasks, "2026-10-11")).toEqual({
      total: 5,
      done: 3,
      open: 2,
      overdue: 0,
      percent: 60,
    });
    expect(getProjectProgress("p3", tasks, "2026-10-11")).toMatchObject({
      total: 4,
      done: 2,
      overdue: 1,
    });
  });

  it("reports zero progress for a project with no tasks", () => {
    expect(getProjectProgress("missing", tasks)).toMatchObject({ total: 0, percent: 0 });
  });
});

describe("sortTasksForList", () => {
  it("puts open tasks first, soonest due first", () => {
    const sorted = sortTasksForList(tasks);
    const firstDone = sorted.findIndex((task) => task.status === "done");
    expect(sorted.slice(0, firstDone).every((task) => task.status !== "done")).toBe(true);
    expect(sorted.slice(firstDone).every((task) => task.status === "done")).toBe(true);
    expect(sorted[0].dueOn <= sorted[1].dueOn).toBe(true);
  });
});

describe("getMonthGrid", () => {
  it("covers the month in whole weeks starting on Sunday", () => {
    const grid = getMonthGrid("2026-10", 0);
    expect(grid).toHaveLength(35);
    expect(grid[0]).toEqual({ iso: "2026-09-27", day: 27, inMonth: false });
    expect(grid.at(-1)?.iso).toBe("2026-10-31");
  });

  it("can start weeks on Monday", () => {
    const grid = getMonthGrid("2026-10", 1);
    expect(grid[0].iso).toBe("2026-09-28");
    expect(grid).toHaveLength(35);
    expect(grid.at(-1)?.iso).toBe("2026-11-01");
  });

  it("handles a February that fits exactly four weeks", () => {
    // February 2026 starts on a Sunday and has 28 days.
    expect(getMonthGrid("2026-02", 0)).toHaveLength(28);
  });
});

describe("shiftMonth", () => {
  it("moves across year ends", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});
