import { defineConfig } from "vitest/config";

/** The bundle budget suite. Separate from the journey and a11y suites: `test:e2e` matches `*.e2e.test.ts` only. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/budget/**/*.budget.test.ts"],
    globalSetup: ["./src/budget-global-setup.ts"],
    retry: 0,
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
