import { defineConfig } from "vitest/config";

/** The visual baseline suite. Separate from the journey, a11y and budget suites: `test:e2e` matches `*.e2e.test.ts` only. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/visual/**/*.visual.test.ts"],
    globalSetup: ["./src/visual-global-setup.ts"],
    retry: 0,
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
