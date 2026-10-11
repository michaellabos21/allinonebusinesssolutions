import type { Metadata } from "next";

import { EstimateDetail } from "@/components/money/estimate-detail";

export const metadata: Metadata = { title: "Estimate" };

export default function Page() {
  return <EstimateDetail />;
}
