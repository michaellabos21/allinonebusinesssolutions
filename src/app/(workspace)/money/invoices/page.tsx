import type { Metadata } from "next";

import { InvoicesScreen } from "@/components/money/invoices-screen";

export const metadata: Metadata = { title: "Invoices" };

export default function Page() {
  return <InvoicesScreen />;
}
