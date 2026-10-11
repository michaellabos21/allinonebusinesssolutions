import { addDays, daysBetween } from "@/lib/format";
import { getToday } from "@/lib/runtime";
import {
  type Deal,
  type DealStage,
  type Invoice,
  type InvoiceDisplayStatus,
  type Payment,
  type Project,
  type Task,
} from "@/mocks";

/**
 * Every dashboard number is derived here from the record arrays, so the
 * summary, charts and lists cannot disagree with each other.
 */

/** Issued and not settled: the invoices that still have money owing. */
const isOpen = (invoice: Invoice) =>
  invoice.status === "sent" || invoice.status === "partially_paid";

/** What is still owed on an invoice. */
export const balanceMinor = (invoice: Invoice) =>
  isOpen(invoice) ? invoice.amountMinor - invoice.paidMinor : 0;

/** An open invoice past its due date shows as overdue; nothing else ever does. */
export function invoiceDisplayStatus(
  invoice: Invoice,
  today: string = getToday(),
): InvoiceDisplayStatus {
  if (isOpen(invoice) && daysBetween(invoice.dueOn, today) > 0) return "overdue";
  return invoice.status;
}

const sumBalances = (invoices: Invoice[]) =>
  invoices.reduce((total, invoice) => total + balanceMinor(invoice), 0);

export type MonthRevenue = {
  /** `YYYY-MM` */
  key: string;
  label: string;
  totalMinor: number;
  /** Number of payments received. */
  paymentCount: number;
  /** True for the current month, which is still in progress. */
  partial: boolean;
};

const MONTH_NAMES = [
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

/** Payments received per calendar month, ending with the current month. */
export function getRevenueByMonth(
  payments: Payment[],
  months = 6,
  today: string = getToday(),
): MonthRevenue[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: months }, (_, index) => {
    const offset = month - (months - 1 - index);
    const y = year + Math.floor(offset / 12);
    const m = ((offset % 12) + 12) % 12;
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    const received = payments.filter((payment) => payment.paidOn.startsWith(key));
    return {
      key,
      label: MONTH_NAMES[m],
      totalMinor: received.reduce((total, payment) => total + payment.amountMinor, 0),
      paymentCount: received.length,
      partial: index === months - 1,
    };
  });
}

/** Invoices with money still owing, soonest due first. */
export function getOpenInvoices(invoices: Invoice[]) {
  return invoices.filter(isOpen).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export function getUpcomingTasks(tasks: Task[]) {
  return tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export function getSummary(
  {
    invoices,
    payments,
    projects,
    tasks,
  }: { invoices: Invoice[]; payments: Payment[]; projects: Project[]; tasks: Task[] },
  today: string = getToday(),
) {
  const [previousMonth, currentMonth] = getRevenueByMonth(payments, 2, today);
  const open = getOpenInvoices(invoices);
  const overdue = open.filter((invoice) => invoiceDisplayStatus(invoice, today) === "overdue");
  const active = projects.filter((project) => project.status === "active");
  const openTasks = getUpcomingTasks(tasks);
  const weekEnd = addDays(today, 6);

  return {
    collectedThisMonthMinor: currentMonth.totalMinor,
    collectedThisMonthCount: currentMonth.paymentCount,
    previousMonthLabel: previousMonth.label,
    collectedPreviousMonthMinor: previousMonth.totalMinor,
    openInvoiceMinor: sumBalances(open),
    openInvoiceCount: open.length,
    overdueInvoiceMinor: sumBalances(overdue),
    overdueInvoiceCount: overdue.length,
    activeProjectCount: active.length,
    projectsDueSoonCount: active.filter((project) => {
      const days = daysBetween(today, project.dueOn);
      return days >= 0 && days <= 30;
    }).length,
    tasksDueThisWeekCount: openTasks.filter((task) => task.dueOn >= today && task.dueOn <= weekEnd)
      .length,
    overdueTaskCount: openTasks.filter((task) => task.dueOn < today).length,
  };
}

export type PipelineStage = {
  id: string;
  label: string;
  dealCount: number;
  valueMinor: number;
};

/** Deals still in play: not archived and not in a won or lost stage. */
export function getOpenDeals(deals: Deal[]) {
  return deals.filter((deal) => !deal.archived && deal.stageKind === "open");
}

/** Open deal count and value for each live open stage, in pipeline order. */
export function getPipeline(deals: Deal[], stages: DealStage[]): PipelineStage[] {
  const open = getOpenDeals(deals);
  return stages
    .filter((stage) => stage.kind === "open" && !stage.archived)
    .sort((a, b) => a.position - b.position)
    .map((stage) => {
      const inStage = open.filter((deal) => deal.stageId === stage.id);
      return {
        id: stage.id,
        label: stage.name,
        dealCount: inStage.length,
        valueMinor: inStage.reduce((total, deal) => total + deal.valueMinor, 0),
      };
    });
}
