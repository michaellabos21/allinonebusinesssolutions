import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Integration tests talk to a real local Supabase stack (`npx supabase start`).
 * They are kept out of `npm test` so unit tests stay runnable without Docker.
 */
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
}));
