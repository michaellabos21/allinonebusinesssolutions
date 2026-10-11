import type { Metadata } from "next";

import { CompaniesScreen } from "@/components/crm/companies-screen";

export const metadata: Metadata = { title: "Companies" };

export default function Page() {
  return <CompaniesScreen />;
}
