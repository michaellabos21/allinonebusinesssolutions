import type { Metadata } from "next";

import { EstimatesScreen } from "@/components/money/estimates-screen";

export const metadata: Metadata = { title: "Estimates" };

export default function Page() {
  return <EstimatesScreen />;
}
