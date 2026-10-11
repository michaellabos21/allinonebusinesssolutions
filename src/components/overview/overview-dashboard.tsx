"use client";

import { PageHeader } from "@/components/common/page-header";
import { GettingStarted } from "@/components/overview/getting-started";
import { PipelineSummary } from "@/components/overview/pipeline-summary";
import { ReceivablesStatement } from "@/components/overview/receivables-statement";
import { RecentActivity } from "@/components/overview/recent-activity";
import { RevenueChart } from "@/components/overview/revenue-chart";
import { SummaryStrip } from "@/components/overview/summary-strip";
import { UpcomingTasks } from "@/components/overview/upcoming-tasks";
import { useDemoStore } from "@/components/providers/demo-store";
import { formatDate } from "@/lib/format";
import { getToday } from "@/lib/runtime";
import { can } from "@/server/permissions";

export function OverviewDashboard({ sampleDataAvailable }: { sampleDataAvailable: boolean }) {
  const { account, contacts, projects, tasks } = useDemoStore();
  const { workspace } = account;
  const firstName = account.user.fullName.split(" ")[0];
  const setUp = contacts.length > 0 && projects.length > 0 && tasks.length > 0;

  if (!can(workspace.role, "records.view")) {
    return (
      <div className="page-container space-y-6">
        <PageHeader title={`Welcome, ${firstName}`} description={workspace.name} />
        <p className="max-w-[60ch] rounded-lg border bg-card px-5 py-4 text-muted-foreground">
          You have client access to this workspace. There is nothing to show yet: the client portal,
          where shared projects and invoices will appear, has not been built.
        </p>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={`${workspace.name}, ${formatDate(getToday(), "weekday")}`}
      />

      {setUp ? null : <GettingStarted sampleDataAvailable={sampleDataAvailable} />}

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
    </div>
  );
}
