"use client";

import { PageHeader } from "@/components/common/page-header";
import { Pill } from "@/components/common/status-badge";
import { GettingStarted } from "@/components/overview/getting-started";
import { PipelineSummary } from "@/components/overview/pipeline-summary";
import { ReceivablesStatement } from "@/components/overview/receivables-statement";
import { RecentActivity } from "@/components/overview/recent-activity";
import { RevenueChart } from "@/components/overview/revenue-chart";
import { SummaryStrip } from "@/components/overview/summary-strip";
import { UpcomingTasks } from "@/components/overview/upcoming-tasks";
import { useDemoStore } from "@/components/providers/demo-store";
import { DEMO_TODAY } from "@/config/app";
import { formatDate } from "@/lib/format";

export function OverviewDashboard() {
  const { demoEnabled, created, workspace, currentUser } = useDemoStore();
  const hasOwnRecords = Object.values(created).some((count) => count > 0);
  const showDashboard = demoEnabled || hasOwnRecords;
  const firstName = currentUser.name.split(" ")[0];

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {workspace.name}, {formatDate(DEMO_TODAY, "weekday")}
            {demoEnabled ? <Pill>Demo data</Pill> : null}
          </span>
        }
      />

      {demoEnabled ? null : <GettingStarted />}

      {showDashboard ? (
        <>
          <ReceivablesStatement />
          <SummaryStrip />
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <RevenueChart />
            </div>
            <PipelineSummary />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <UpcomingTasks />
            <RecentActivity />
          </div>
        </>
      ) : null}
    </div>
  );
}
