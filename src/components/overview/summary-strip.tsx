"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { useDemoStore } from "@/components/providers/demo-store";
import { DEMO_TODAY } from "@/config/app";
import { formatMoney } from "@/lib/format";
import { getSummary } from "@/lib/metrics";
import { formatMonthName } from "@/lib/work";

type Metric = {
  label: string;
  value: string;
  note: string;
  /** Needs attention; shown with a warning icon as well as colour. */
  alert?: string;
  href: string;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Headline figures in one ruled band; each cell links to its module. Open invoices have their own statement above. */
export function SummaryStrip() {
  const { invoices, projects, tasks } = useDemoStore();
  const s = getSummary({ invoices, projects, tasks });
  const monthName = formatMonthName(DEMO_TODAY.slice(0, 7));

  const metrics: Metric[] = [
    {
      label: `Collected in ${monthName}`,
      value: formatMoney(s.collectedThisMonthMinor),
      note: `${plural(s.collectedThisMonthCount, "payment", "payments")} so far. ${s.previousMonthLabel} closed at ${formatMoney(s.collectedPreviousMonthMinor)}.`,
      href: "/money/invoices",
    },
    {
      label: "Active projects",
      value: String(s.activeProjectCount),
      note: `${s.projectsDueSoonCount} due in the next 30 days.`,
      href: "/work/projects",
    },
    {
      label: "Tasks due this week",
      value: String(s.tasksDueThisWeekCount),
      note: "Open tasks due in the next 7 days.",
      alert: s.overdueTaskCount > 0 ? `${s.overdueTaskCount} overdue` : undefined,
      href: "/work/tasks",
    },
  ];

  return (
    <section aria-label="Summary" className="overflow-hidden rounded-lg border bg-card">
      <dl className="grid sm:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="relative -mt-px -ml-px border-t border-l px-5 py-4 hover:bg-muted/50"
          >
            <dt className="text-muted-foreground">
              <Link href={metric.href} className="after:absolute after:inset-0">
                {metric.label}
              </Link>
            </dt>
            <dd className="mt-1">
              <span className="block font-display text-figure">{metric.value}</span>
              <span className="mt-1 block text-caption text-muted-foreground">{metric.note}</span>
              {metric.alert ? (
                <span className="mt-1.5 flex items-center gap-1 text-caption font-medium text-danger">
                  <TriangleAlert className="size-3.5" aria-hidden />
                  {metric.alert}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
