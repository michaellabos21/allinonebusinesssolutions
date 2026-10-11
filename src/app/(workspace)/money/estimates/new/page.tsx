import type { Metadata } from "next";

import { DocumentEditor } from "@/components/money/invoice-editor";

export const metadata: Metadata = { title: "New estimate" };

export default function Page() {
  return <DocumentEditor kind="estimate" />;
}
