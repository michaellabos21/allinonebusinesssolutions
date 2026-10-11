import type { Metadata } from "next";

import { CompanyDetail } from "@/components/crm/company-detail";

export const metadata: Metadata = { title: "Company" };

export default function Page() {
  return <CompanyDetail />;
}
