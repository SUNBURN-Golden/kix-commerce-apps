import { defineConfig } from "vitest/config";

/** The accessibility observation suite. Separate from the journey suite: `test:e2e` matches `*.e2e.test.ts` only. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/a11y/**/*.a11y.test.ts"],
    globalSetup: ["./src/a11y-global-setup.ts"],
    retry: 0,
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
