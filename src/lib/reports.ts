import { DEMO_TODAY } from "@/config/app";
import { invoiceDisplayStatus } from "@/lib/metrics";
import { memberName } from "@/lib/runtime";
import type { Expense, Invoice, InvoiceDisplayStatus, Project, Task } from "@/mocks";

/** Report figures, all derived from the same records the other screens use. */

export type RangeId = "this-month" | "last-3" | "last-6" | "ytd";
export type DateRange = { id: RangeId; label: string; from: string; to: string; months: string[] };

export const RANGE_OPTIONS: { value: RangeId; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-3", label: "Last 3 months" },
  { value: "last-6", label: "Last 6 months" },
  { value: "ytd", label: "Year to date" },
];

/** Resolves a preset to dates. Every range ends today, so the last month is partial. */
export function getRange(id: RangeId, today: string = DEMO_TODAY): DateRange {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const span = id === "this-month" ? 1 : id === "last-3" ? 3 : id === "last-6" ? 6 : month;
  const months = Array.from({ length: span }, (_, index) =>
    new Date(Date.UTC(year, month - span + index, 1)).toISOString().slice(0, 7),
  );
  return {
    id,
    label: RANGE_OPTIONS.find((option) => option.value === id)?.label ?? "",
    from: `${months[0]}-01`,
    to: today,
    months,
  };
}

const inRange = (date: string | null, range: DateRange) => date !== null && date >= range.from && date <= range.to;
const sum = (rows: { amountMinor: number }[]) => rows.reduce((total, row) => total + row.amountMinor, 0);
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

export type MonthFlow = { key: string; label: string; collectedMinor: number; expenseMinor: number; partial: boolean };

/** Payments received and expenses paid, month by month. */
export function getMoneyFlow(invoices: Invoice[], expenses: Expense[], range: DateRange): MonthFlow[] {
  return range.months.map((key, index) => ({
    key,
    label: SHORT_MONTHS[Number(key.slice(5, 7)) - 1],
    collectedMinor: sum(invoices.filter((invoice) => invoice.paidOn?.startsWith(key) && inRange(invoice.paidOn, range))),
    expenseMinor: sum(expenses.filter((expense) => expense.date.startsWith(key) && inRange(expense.date, range))),
    partial: index === range.months.length - 1,
  }));
}

export function getHeadline(invoices: Invoice[], expenses: Expense[], range: DateRange) {
  const collectedMinor = sum(invoices.filter((invoice) => inRange(invoice.paidOn, range)));
  const billed = invoices.filter((invoice) => invoice.status !== "draft" && inRange(invoice.issuedOn, range));
  const expenseMinor = sum(expenses.filter((expense) => inRange(expense.date, range)));
  return {
    collectedMinor,
    billedMinor: sum(billed),
    billedCount: billed.length,
    expenseMinor,
    netMinor: collectedMinor - expenseMinor,
  };
}

const STATUS_ORDER: InvoiceDisplayStatus[] = ["paid", "sent", "overdue", "draft"];
export const STATUS_LABEL: Record<InvoiceDisplayStatus, string> = {
  paid: "Paid",
  sent: "Sent, not yet due",
  overdue: "Overdue",
  draft: "Draft",
};

/** Invoices issued in the range, grouped by where they stand today. */
export function getInvoiceStatusBreakdown(invoices: Invoice[], range: DateRange) {
  const issued = invoices.filter((invoice) => inRange(invoice.issuedOn, range));
  return STATUS_ORDER.map((status) => {
    const rows = issued.filter((invoice) => invoiceDisplayStatus(invoice) === status);
    return { status, label: STATUS_LABEL[status], count: rows.length, amountMinor: sum(rows) };
  });
}

/** Tasks due in the range per person, split into done and still open. */
export function getTaskLoad(tasks: Task[], range: DateRange) {
  const due = tasks.filter((task) => inRange(task.dueOn, range));
  const ids = [...new Set(due.map((task) => task.assigneeId))];
  return ids
    .map((id) => {
      const own = due.filter((task) => task.assigneeId === id);
      const done = own.filter((task) => task.status === "done").length;
      return {
        id,
        name: memberName(id),
        done,
        open: own.length - done,
        overdue: own.filter((task) => task.status !== "done" && task.dueOn < range.to).length,
      };
    })
    .sort((a, b) => b.done + b.open - (a.done + a.open));
}

/** Per-project task progress and spend. Progress is all-time; spend is within the range. */
export function getProjectReport(projects: Project[], tasks: Task[], expenses: Expense[], range: DateRange) {
  return projects.map((project) => {
    const own = tasks.filter((task) => task.projectId === project.id);
    return {
      project,
      total: own.length,
      done: own.filter((task) => task.status === "done").length,
      spendMinor: sum(expenses.filter((expense) => expense.projectId === project.id && inRange(expense.date, range))),
    };
  });
}

export function getExpenseCategories(expenses: Expense[], range: DateRange) {
  const totals = new Map<string, { amountMinor: number; count: number }>();
  for (const expense of expenses) {
    if (!inRange(expense.date, range)) continue;
    const current = totals.get(expense.category) ?? { amountMinor: 0, count: 0 };
    totals.set(expense.category, { amountMinor: current.amountMinor + expense.amountMinor, count: current.count + 1 });
  }
  return [...totals.entries()]
    .map(([category, value]) => ({ category, ...value }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}
