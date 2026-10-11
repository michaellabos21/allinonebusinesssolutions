import type { Metadata } from "next";

import { LeadFormsScreen } from "@/components/crm/lead-forms-screen";

export const metadata: Metadata = { title: "Lead forms" };

export default function Page() {
  return <LeadFormsScreen />;
}
