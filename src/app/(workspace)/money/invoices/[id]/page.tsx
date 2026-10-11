import type { Metadata } from "next";

import { InvoiceDetail } from "@/components/money/invoice-detail";

export const metadata: Metadata = { title: "Invoice" };

export default function Page() {
  return <InvoiceDetail />;
}
