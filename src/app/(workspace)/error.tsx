"use client";

import { ErrorState } from "@/components/common/states";

export default function WorkspaceError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="page-container">
      <ErrorState onRetry={retry} />
    </div>
  );
}
