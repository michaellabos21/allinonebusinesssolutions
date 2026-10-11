"use client";

import { ChartColumn } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/common/page-header";
import { Panel } from "@/components/common/panel";
import { EmptyState } from "@/components/common/states";
import { ProjectStatusBadge } from "@/components/common/status-badge";
import { SegmentedControl } from "@/components/common/table-toolbar";
import { useDemoStore } from "@/components/providers/demo-store";
import { ProgressBar } from "@/components/work/progress-bar";
import { formatDate, formatMoney, formatMoneyCompact } from "@/lib/format";
import {
  type MonthFlow,
  RANGE_OPTIONS,
  type RangeId,
  getExpenseCategories,
  getHeadline,
  getInvoiceStatusBreakdown,
  getMoneyFlow,
  getProjectReport,
  getRange,
  getTaskLoad,
} from "@/lib/reports";
import { getToday } from "@/lib/runtime";
import { cn } from "@/lib/utils";
import type { InvoiceDisplayStatus } from "@/mocks";

const STATUS_SWATCH: Record<InvoiceDisplayStatus, string> = {
  paid: "bg-success",
  sent: "bg-[var(--chart-1)]",
  overdue: "bg-danger",
  draft: "bg-input",
};

function FlowTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: MonthFlow }[];
}) {
  const month = payload?.[0]?.payload;
  if (!active || !month) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 shadow-popover">
      <p className="text-xs text-muted-foreground">
        {month.label}
        {month.partial ? ", month to date" : ""}
      </p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        <dt className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-[var(--chart-1)]" aria-hidden />
          Collected
        </dt>
        <dd className="tabular text-right font-medium">{formatMoney(month.collectedMinor)}</dd>
        <dt className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-[var(--chart-3)]" aria-hidden />
          Expenses
        </dt>
        <dd className="tabular text-right font-medium">{formatMoney(month.expenseMinor)}</dd>
      </dl>
    </div>
  );
}

export function ReportsScreen() {
  const { invoices, expenses, tasks, projects } = useDemoStore();
  const [rangeId, setRangeId] = useState<RangeId>("last-6");
  const range = getRange(rangeId);

  const headline = getHeadline(invoices, expenses, range);
  const flow = getMoneyFlow(invoices, expenses, range);
  const statuses = getInvoiceStatusBreakdown(invoices, range);
  const issuedCount = statuses.reduce((total, row) => total + row.count, 0);
  const issuedMinor = statuses.reduce((total, row) => total + row.amountMinor, 0);
  // Tasks and projects are real, so their panels count back from the real date.
  const taskLoad = getTaskLoad(tasks, getRange(rangeId, getToday()));
  const busiest = Math.max(...taskLoad.map((row) => row.done + row.open), 1);
  const projectRows = getProjectReport(projects, tasks, expenses, range);
  const categories = getExpenseCategories(expenses, range);
  const topCategory = categories[0]?.amountMinor ?? 1;
  const hasData = invoices.length + expenses.length + tasks.length + projects.length > 0;

  const figures = [
    {
      label: "Collected",
      value: headline.collectedMinor,
      note: "Payments recorded in this period.",
    },
    {
      label: "Invoiced",
      value: headline.billedMinor,
      note: `${headline.billedCount} ${headline.billedCount === 1 ? "invoice" : "invoices"} sent in this period.`,
    },
    { label: "Expenses", value: headline.expenseMinor, note: "Spending dated in this period." },
    {
      label: "Net",
      value: headline.netMinor,
      note: "Collected minus expenses.",
      negative: headline.netMinor < 0,
    },
  ];

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Reports"
        description={`${range.label}: ${formatDate(range.from, "long")} to ${formatDate(range.to, "long")}. Every figure is computed from the records in this workspace.`}
        actions={
          <SegmentedControl
            label="Date range"
            options={RANGE_OPTIONS}
            value={rangeId}
            onChange={setRangeId}
          />
        }
      />

      {!hasData ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={ChartColumn}
            title="Nothing to report yet"
            description="Reports fill in as you add invoices, expenses, projects and tasks. Turn demo data on in the sidebar to see them with sample records."
            className="py-16"
          />
        </div>
      ) : (
        <>
          <section
            aria-label="Headline figures"
            className="overflow-hidden rounded-lg border bg-card"
          >
            <dl className="grid grid-cols-2 lg:grid-cols-4">
              {figures.map((figure) => (
                <div key={figure.label} className="-mt-px -ml-px border-t border-l px-5 py-4">
                  <dt className="text-muted-foreground">{figure.label}</dt>
                  <dd className="mt-1">
                    <span
                      className={cn(
                        "block font-display text-figure",
                        figure.negative && "text-danger",
                      )}
                    >
                      {formatMoney(figure.value)}
                    </span>
                    <span className="mt-1 block text-caption text-muted-foreground">
                      {figure.note}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <Panel
            title="Money in and out"
            description="Payments received against expenses paid, by month."
            action={
              <ul className="flex items-center gap-4 text-caption" aria-label="Legend">
                <li className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-[var(--chart-1)]" aria-hidden />
                  Collected
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-[var(--chart-3)]" aria-hidden />
                  Expenses
                </li>
              </ul>
            }
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="h-64" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={flow}
                    margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
                    barCategoryGap="24%"
                    barGap={2}
                  >
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={{ stroke: "var(--border)" }}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <YAxis
                      width={56}
                      tickLine={false}
                      axisLine={false}
                      tickCount={4}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      tickFormatter={(value: number) => formatMoneyCompact(value)}
                    />
                    <Tooltip cursor={{ fill: "var(--muted)" }} content={<FlowTooltip />} />
                    <Bar
                      dataKey="collectedMinor"
                      fill="var(--chart-1)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="expenseMinor"
                      fill="var(--chart-3)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="relative overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">Collected, expenses and net by month</caption>
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Month
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Collected
                      </th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">
                        Expenses
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Net
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {flow.map((month) => (
                      <tr key={month.key} className="border-b border-dashed last:border-b-0">
                        <th scope="row" className="py-2 pr-3 font-normal whitespace-nowrap">
                          {month.label}
                          {month.partial ? (
                            <span className="text-muted-foreground"> (to date)</span>
                          ) : null}
                        </th>
                        <td className="py-2 pr-3 text-right whitespace-nowrap">
                          {formatMoney(month.collectedMinor)}
                        </td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap">
                          {formatMoney(month.expenseMinor)}
                        </td>
                        <td className="py-2 text-right font-medium whitespace-nowrap">
                          {formatMoney(month.collectedMinor - month.expenseMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title="Invoice status"
              description={
                issuedCount > 0
                  ? `${issuedCount} ${issuedCount === 1 ? "invoice" : "invoices"} dated in this period, worth ${formatMoney(issuedMinor)}, by where they stand today.`
                  : "No invoices are dated in this period."
              }
              action={
                <Link
                  href="/money/invoices"
                  className="text-caption font-medium text-primary hover:underline"
                >
                  View invoices
                </Link>
              }
            >
              {issuedCount > 0 ? (
                <>
                  <div className="flex h-3 gap-0.5" aria-hidden>
                    {statuses
                      .filter((row) => row.amountMinor > 0)
                      .map((row) => (
                        <span
                          key={row.status}
                          className={cn("rounded-sm", STATUS_SWATCH[row.status])}
                          style={{ flexGrow: row.amountMinor }}
                        />
                      ))}
                  </div>
                  <table className="mt-4 w-full border-collapse text-left">
                    <caption className="sr-only">Invoices by status</caption>
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Status
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">
                          Invoices
                        </th>
                        <th scope="col" className="py-2 text-right font-medium">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="tabular">
                      {statuses.map((row) => (
                        <tr key={row.status} className="border-b border-dashed last:border-b-0">
                          <th scope="row" className="py-2 pr-3 font-normal">
                            <span className="flex items-center gap-2">
                              <span
                                className={cn("size-2.5 rounded-[3px]", STATUS_SWATCH[row.status])}
                                aria-hidden
                              />
                              {row.label}
                            </span>
                          </th>
                          <td className="py-2 pr-3 text-right">{row.count}</td>
                          <td className="py-2 text-right">{formatMoney(row.amountMinor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}
            </Panel>

            <Panel
              title="Expenses by category"
              description={
                categories.length > 0
                  ? `${formatMoney(headline.expenseMinor)} across ${categories.length} ${categories.length === 1 ? "category" : "categories"}.`
                  : "No expenses are dated in this period."
              }
              action={
                <Link
                  href="/money/expenses"
                  className="text-caption font-medium text-primary hover:underline"
                >
                  View expenses
                </Link>
              }
            >
              {categories.length > 0 ? (
                <ul className="space-y-3 pt-1">
                  {categories.map((row) => (
                    <li key={row.category}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span>
                          {row.category}{" "}
                          <span className="tabular text-caption text-muted-foreground">
                            {row.count} {row.count === 1 ? "expense" : "expenses"}
                          </span>
                        </span>
                        <span className="tabular">{formatMoney(row.amountMinor)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-sm bg-muted" aria-hidden>
                        <div
                          className="h-full rounded-sm bg-[var(--chart-3)]"
                          style={{
                            width: `${Math.max((row.amountMinor / topCategory) * 100, 1.5)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title="Tasks by person"
              description={
                taskLoad.length > 0
                  ? "Tasks due in this period, split into done and still open."
                  : "No tasks are due in this period."
              }
              action={
                taskLoad.length > 0 ? (
                  <ul className="flex items-center gap-4 text-caption" aria-label="Legend">
                    <li className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-[3px] bg-[var(--chart-1)]" aria-hidden />
                      Done
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-[3px] bg-[var(--chart-2)]" aria-hidden />
                      Open
                    </li>
                  </ul>
                ) : null
              }
            >
              {taskLoad.length > 0 ? (
                <ul className="space-y-3.5 pt-1">
                  {taskLoad.map((row) => (
                    <li key={row.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{row.name}</span>
                        <span className="tabular text-caption text-muted-foreground">
                          {row.done} done, {row.open} open
                          {row.overdue > 0 ? (
                            <span className="font-medium text-danger">
                              {" "}
                              ({row.overdue} overdue)
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div
                        className="mt-1.5 flex h-2 gap-0.5"
                        style={{ width: `${((row.done + row.open) / busiest) * 100}%` }}
                        aria-hidden
                      >
                        {row.done > 0 ? (
                          <span
                            className="rounded-sm bg-[var(--chart-1)]"
                            style={{ flexGrow: row.done }}
                          />
                        ) : null}
                        {row.open > 0 ? (
                          <span
                            className="rounded-sm bg-[var(--chart-2)]"
                            style={{ flexGrow: row.open }}
                          />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>

            <Panel
              title="Projects"
              description={
                projectRows.length > 0
                  ? "Task progress to date, and expenses logged against each project in this period."
                  : "No projects yet."
              }
              action={
                <Link
                  href="/work/projects"
                  className="text-caption font-medium text-primary hover:underline"
                >
                  View projects
                </Link>
              }
              bodyClassName="px-0 pb-1"
            >
              {projectRows.length > 0 ? (
                <div className="relative overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <caption className="sr-only">Project progress and spend</caption>
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th scope="col" className="py-2 pr-3 pl-5 font-medium">
                          Project
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Tasks done
                        </th>
                        <th scope="col" className="py-2 pr-5 text-right font-medium">
                          Spend
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectRows.map(({ project, done, total, spendMinor }) => (
                        <tr key={project.id} className="border-b border-dashed last:border-b-0">
                          <th scope="row" className="py-2.5 pr-3 pl-5 font-normal">
                            <Link
                              href={`/work/projects/${project.id}`}
                              className="font-medium hover:underline"
                            >
                              {project.name}
                            </Link>
                            <span className="mt-0.5 block">
                              <ProjectStatusBadge status={project.status} />
                            </span>
                          </th>
                          <td className="py-2.5 pr-3">
                            <ProgressBar done={done} total={total} className="min-w-28" />
                          </td>
                          <td className="tabular py-2.5 pr-5 text-right whitespace-nowrap">
                            {spendMinor > 0 ? (
                              formatMoney(spendMinor)
                            ) : (
                              <span className="text-muted-foreground">None</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
