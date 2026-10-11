import type { Metadata } from "next";

import { LeadsScreen } from "@/components/crm/leads-screen";

export const metadata: Metadata = { title: "Leads" };

export default function Page() {
  return <LeadsScreen />;
}
