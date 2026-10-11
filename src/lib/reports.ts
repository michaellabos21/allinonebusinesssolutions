import { balanceMinor, invoiceDisplayStatus } from "@/lib/metrics";
import { getToday, memberName } from "@/lib/runtime";
import type { Expense, Invoice, InvoiceDisplayStatus, Payment, Project, Task } from "@/mocks";

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
export function getRange(id: RangeId, today: string = getToday()): DateRange {
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

const inRange = (date: string | null, range: DateRange) =>
  date !== null && date >= range.from && date <= range.to;
const sum = (rows: { amountMinor: number }[]) =>
  rows.reduce((total, row) => total + row.amountMinor, 0);
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];

export type MonthFlow = {
  key: string;
  label: string;
  collectedMinor: number;
  expenseMinor: number;
  partial: boolean;
};

/** Payments received and expenses paid, month by month. */
export function getMoneyFlow(
  payments: Payment[],
  expenses: Expense[],
  range: DateRange,
): MonthFlow[] {
  const live = expenses.filter((expense) => !expense.archived);
  return range.months.map((key, index) => ({
    key,
    label: SHORT_MONTHS[Number(key.slice(5, 7)) - 1],
    collectedMinor: sum(
      payments.filter(
        (payment) => payment.paidOn.startsWith(key) && inRange(payment.paidOn, range),
      ),
    ),
    expenseMinor: sum(
      live.filter((expense) => expense.date.startsWith(key) && inRange(expense.date, range)),
    ),
    partial: index === range.months.length - 1,
  }));
}

/**
 * The four finance figures, each defined exactly:
 *
 *   invoiced     totals of invoices issued in the range, not counting drafts or voided ones
 *   collected    payments recorded with a payment date in the range
 *   outstanding  what is still owed today on every open invoice, whenever issued
 *   expenses     expenses dated in the range, not counting archived ones
 *
 * These are cash figures for running the business. They are not an income
 * statement, and "collected minus expenses" is not profit.
 */
export function getHeadline(
  invoices: Invoice[],
  payments: Payment[],
  expenses: Expense[],
  range: DateRange,
) {
  const issued = invoices.filter(
    (invoice) =>
      invoice.status !== "draft" && invoice.status !== "void" && inRange(invoice.issuedOn, range),
  );
  const open = invoices.filter((invoice) => balanceMinor(invoice) > 0);
  return {
    invoicedMinor: sum(issued),
    invoicedCount: issued.length,
    collectedMinor: sum(payments.filter((payment) => inRange(payment.paidOn, range))),
    outstandingMinor: open.reduce((total, invoice) => total + balanceMinor(invoice), 0),
    outstandingCount: open.length,
    expenseMinor: sum(
      expenses.filter((expense) => !expense.archived && inRange(expense.date, range)),
    ),
  };
}

const STATUS_ORDER: InvoiceDisplayStatus[] = ["paid", "partially_paid", "sent", "overdue", "void"];
export const STATUS_LABEL: Record<InvoiceDisplayStatus, string> = {
  paid: "Paid",
  partially_paid: "Part paid",
  sent: "Sent, not yet due",
  overdue: "Overdue",
  draft: "Draft",
  void: "Void",
};

/** Invoices issued in the range, grouped by where they stand today. */
export function getInvoiceStatusBreakdown(invoices: Invoice[], range: DateRange) {
  const issued = invoices.filter(
    (invoice) => invoice.status !== "draft" && inRange(invoice.issuedOn, range),
  );
  return STATUS_ORDER.map((status) => {
    const rows = issued.filter((invoice) => invoiceDisplayStatus(invoice, range.to) === status);
    return { status, label: STATUS_LABEL[status], count: rows.length, amountMinor: sum(rows) };
  });
}

/**
 * Tasks due in the range per person, split into done and still open. A task
 * with several assignees counts for each of them; unassigned and undated
 * tasks are left out.
 */
export function getTaskLoad(tasks: Task[], range: DateRange) {
  const due = tasks.filter((task) => inRange(task.dueOn, range));
  const ids = [...new Set(due.flatMap((task) => task.assigneeIds))];
  return ids
    .map((id) => {
      const own = due.filter((task) => task.assigneeIds.includes(id));
      const done = own.filter((task) => task.status === "done").length;
      return {
        id,
        name: memberName(id),
        done,
        open: own.length - done,
        overdue: own.filter(
          (task) => task.status !== "done" && task.dueOn !== null && task.dueOn < range.to,
        ).length,
      };
    })
    .sort((a, b) => b.done + b.open - (a.done + a.open));
}

/** Per-project task progress and spend. Progress is all-time; spend is within the range. */
export function getProjectReport(
  projects: Project[],
  tasks: Task[],
  expenses: Expense[],
  range: DateRange,
) {
  return projects.map((project) => {
    const own = tasks.filter((task) => task.projectId === project.id);
    return {
      project,
      total: own.length,
      done: own.filter((task) => task.status === "done").length,
      spendMinor: sum(
        expenses.filter(
          (expense) =>
            !expense.archived && expense.projectId === project.id && inRange(expense.date, range),
        ),
      ),
    };
  });
}

export function getExpenseCategories(expenses: Expense[], range: DateRange) {
  const totals = new Map<string, { amountMinor: number; count: number }>();
  for (const expense of expenses) {
    if (expense.archived || !inRange(expense.date, range)) continue;
    const current = totals.get(expense.category) ?? { amountMinor: 0, count: 0 };
    totals.set(expense.category, {
      amountMinor: current.amountMinor + expense.amountMinor,
      count: current.count + 1,
    });
  }
  return [...totals.entries()]
    .map(([category, value]) => ({ category, ...value }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}
