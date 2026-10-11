import type { Metadata } from "next";

import { InvoiceEditRoute } from "@/components/money/invoice-editor";

export const metadata: Metadata = { title: "Edit invoice" };

export default function Page() {
  return <InvoiceEditRoute />;
}
