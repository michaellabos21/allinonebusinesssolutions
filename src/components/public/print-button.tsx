"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog, where "Save as PDF" gives a clean copy. */
export function PrintButton({ label = "Download PDF" }: { label?: string }) {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Download data-icon="inline-start" aria-hidden />
      {label}
    </Button>
  );
}
