import type { Metadata } from "next";

import { DealsScreen } from "@/components/crm/deals-screen";

export const metadata: Metadata = { title: "Leads & Deals" };

export default function Page() {
  return <DealsScreen />;
}
