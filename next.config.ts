import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Next's dev-only "instant navigation" check assumes pages can render
    // before the session is known. Every workspace page here waits for the
    // signed-in user, so the check is opt-in per segment, not on by default.
    instantInsights: { validationLevel: "manual-warning" },
    // Receipts may be up to 5 MB; leave room for the form's own overhead.
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    // Pin the root to this project; a stray lockfile higher up would otherwise win.
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
