"use client";

import { useEffect } from "react";

import { logger } from "@/lib/logger";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * whole document, so it carries its own minimal styles instead of the theme.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    logger.error("app.global_error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#f5f4f0",
          color: "#1c2434",
        }}
      >
        <title>Something went wrong</title>
        <main role="alert" style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>The app couldn’t load</h1>
          <p style={{ margin: "0 0 20px", color: "#5b6577", lineHeight: 1.5 }}>
            Something failed before the page could render. Try again, and if it keeps happening,
            reload the page.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 8,
              border: 0,
              background: "#34479e",
              color: "#fff",
              font: "inherit",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
