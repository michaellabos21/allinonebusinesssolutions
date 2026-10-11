"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/common/states";
import { logger } from "@/lib/logger";

export default function WorkspaceError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    logger.error("app.route_error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="page-container">
      <ErrorState onRetry={retry} />
    </div>
  );
}
