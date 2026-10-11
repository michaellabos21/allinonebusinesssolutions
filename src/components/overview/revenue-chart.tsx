"use client";

import { ReceiptText } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Panel } from "@/components/common/panel";
import { EmptyState } from "@/components/common/states";
import { SegmentedControl } from "@/components/common/table-toolbar";
import { useDemoStore } from "@/components/providers/demo-store";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { getRevenueByMonth, type MonthRevenue } from "@/lib/metrics";

const RANGES = [
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
];

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: MonthRevenue }[] }) {
  const month = payload?.[0]?.payload;
  if (!active || !month) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 shadow-popover">
      <p className="text-xs text-muted-foreground">
        {month.label}
        {month.partial ? ", month to date" : ""}
      </p>
      <p className="tabular font-semibold">{formatMoney(month.totalMinor)}</p>
      <p className="text-xs text-muted-foreground">
        {month.invoiceCount} {month.invoiceCount === 1 ? "invoice" : "invoices"} paid
      </p>
    </div>
  );
}

/** Payments received per month, from paid invoices. */
export function RevenueChart() {
  const { invoices } = useDemoStore();
  const [months, setMonths] = useState(6);
  const data = getRevenueByMonth(invoices, months);
  const totalMinor = data.reduce((sum, month) => sum + month.totalMinor, 0);
  const current = data[data.length - 1];

  return (
    <Panel
      title="Payments received"
      description={
        totalMinor > 0
          ? `${formatMoney(totalMinor)} collected over the last ${months} months.`
          : "Totals appear here once invoices are paid."
      }
      action={
        <SegmentedControl
          label="Chart range"
          options={RANGES.map((range) => ({ value: range.months, label: range.label }))}
          value={months}
          onChange={setMonths}
        />
      }
    >
      {totalMinor === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No payments recorded yet"
          description="Marking invoices as paid arrives with the Invoices screen in a later phase."
          className="h-64 justify-center"
        />
      ) : (
        <>
          <div className="h-64" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
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
                <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip />} />
                <Bar dataKey="totalMinor" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                  {data.map((month) => (
                    <Cell key={month.key} fill={month.partial ? "var(--chart-2)" : "var(--chart-1)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-caption text-muted-foreground">
            <span className="size-2.5 rounded-[3px] bg-[var(--chart-2)]" aria-hidden />
            {current.label} is month to date.
          </p>
          <table className="sr-only">
            <caption>Payments received by month</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Collected</th>
                <th scope="col">Invoices paid</th>
              </tr>
            </thead>
            <tbody>
              {data.map((month) => (
                <tr key={month.key}>
                  <th scope="row">
                    {month.label}
                    {month.partial ? " (month to date)" : ""}
                  </th>
                  <td>{formatMoney(month.totalMinor)}</td>
                  <td>{month.invoiceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}
