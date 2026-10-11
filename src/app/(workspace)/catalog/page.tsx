import type { Metadata } from "next";

import { CatalogScreen } from "@/components/money/catalog-screen";

export const metadata: Metadata = { title: "Products & Services" };

export default function Page() {
  return <CatalogScreen />;
}
