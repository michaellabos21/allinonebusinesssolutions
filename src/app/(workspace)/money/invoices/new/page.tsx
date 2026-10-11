import type { Metadata } from "next";

import { DocumentEditor } from "@/components/money/invoice-editor";

export const metadata: Metadata = { title: "New invoice" };

export default function Page() {
  return <DocumentEditor kind="invoice" />;
}
