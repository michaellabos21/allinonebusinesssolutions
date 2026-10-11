import type { Metadata } from "next";

import { InvoiceEditor } from "@/components/money/invoice-editor";

export const metadata: Metadata = { title: "New invoice" };

export default function Page() {
  return <InvoiceEditor />;
}
