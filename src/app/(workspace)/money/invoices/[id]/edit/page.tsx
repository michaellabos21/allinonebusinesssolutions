import type { Metadata } from "next";

import { DocumentEditRoute } from "@/components/money/invoice-editor";

export const metadata: Metadata = { title: "Edit invoice" };

export default function Page() {
  return <DocumentEditRoute kind="invoice" />;
}
