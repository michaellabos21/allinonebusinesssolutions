import { DEMO_TODAY } from "@/config/app";
import { addDays, daysBetween } from "@/lib/format";
import {
  OPEN_DEAL_STAGES,
  type Deal,
  type Invoice,
  type InvoiceDisplayStatus,
  type Project,
  type Task,
} from "@/mocks";

/**
 * Every dashboard number is derived here from the record arrays, so the
 * summary, charts and lists cannot disagree with each other.
 */

export function invoiceDisplayStatus(
  invoice: Invoice,
  today: string = DEMO_TODAY,
): InvoiceDisplayStatus {
  if (invoice.status === "sent" && daysBetween(invoice.dueOn, today) > 0) return "overdue";
  return invoice.status;
}

const sumMinor = (invoices: Invoice[]) =>
  invoices.reduce((total, invoice) => total + invoice.amountMinor, 0);

export type MonthRevenue = {
  /** `YYYY-MM` */
  key: string;
  label: string;
  totalMinor: number;
  invoiceCount: number;
  /** True for the current month, which is still in progress. */
  partial: boolean;
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

/** Payments received per calendar month, ending with the current month. */
export function getRevenueByMonth(
  invoices: Invoice[],
  months = 6,
  today: string = DEMO_TODAY,
): MonthRevenue[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: months }, (_, index) => {
    const offset = month - (months - 1 - index);
    const y = year + Math.floor(offset / 12);
    const m = ((offset % 12) + 12) % 12;
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    const paid = invoices.filter((invoice) => invoice.paidOn?.startsWith(key));
    return {
      key,
      label: MONTH_NAMES[m],
      totalMinor: sumMinor(paid),
      invoiceCount: paid.length,
      partial: index === months - 1,
    };
  });
}

export function getOpenInvoices(invoices: Invoice[]) {
  return invoices
    .filter((invoice) => invoice.status === "sent")
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export function getUpcomingTasks(tasks: Task[]) {
  return tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export function getSummary(
  { invoices, projects, tasks }: { invoices: Invoice[]; projects: Project[]; tasks: Task[] },
  today: string = DEMO_TODAY,
) {
  const [previousMonth, currentMonth] = getRevenueByMonth(invoices, 2, today);
  const open = getOpenInvoices(invoices);
  const overdue = open.filter((invoice) => invoiceDisplayStatus(invoice, today) === "overdue");
  const active = projects.filter((project) => project.status === "active");
  const openTasks = getUpcomingTasks(tasks);
  const weekEnd = addDays(today, 6);

  return {
    collectedThisMonthMinor: currentMonth.totalMinor,
    collectedThisMonthCount: currentMonth.invoiceCount,
    previousMonthLabel: previousMonth.label,
    collectedPreviousMonthMinor: previousMonth.totalMinor,
    openInvoiceMinor: sumMinor(open),
    openInvoiceCount: open.length,
    overdueInvoiceMinor: sumMinor(overdue),
    overdueInvoiceCount: overdue.length,
    activeProjectCount: active.length,
    projectsDueSoonCount: active.filter((project) => {
      const days = daysBetween(today, project.dueOn);
      return days >= 0 && days <= 30;
    }).length,
    tasksDueThisWeekCount: openTasks.filter(
      (task) => task.dueOn >= today && task.dueOn <= weekEnd,
    ).length,
    overdueTaskCount: openTasks.filter((task) => task.dueOn < today).length,
  };
}

export type PipelineStage = {
  id: string;
  label: string;
  dealCount: number;
  valueMinor: number;
};

/** Deals still in play: not archived and not closed as won or lost. */
export function getOpenDeals(deals: Deal[]) {
  const openStages = new Set(OPEN_DEAL_STAGES.map((stage) => stage.id));
  return deals.filter((deal) => !deal.archived && openStages.has(deal.stage));
}

export function getPipeline(deals: Deal[]): PipelineStage[] {
  const open = getOpenDeals(deals);
  return OPEN_DEAL_STAGES.map((stage) => {
    const inStage = open.filter((deal) => deal.stage === stage.id);
    return {
      id: stage.id,
      label: stage.label,
      dealCount: inStage.length,
      valueMinor: inStage.reduce((total, deal) => total + deal.valueMinor, 0),
    };
  });
}
