import type { Metadata } from "next";

import { OverviewDashboard } from "@/components/overview/overview-dashboard";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  // Server-only flag: the sample-records loader is offered in development and
  // demo environments, never by default.
  return <OverviewDashboard sampleDataAvailable={process.env.ENABLE_SAMPLE_DATA === "true"} />;
}
