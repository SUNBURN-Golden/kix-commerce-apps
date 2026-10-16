import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.e2e.test.ts"],
    globalSetup: ["./src/global-setup.ts"],
    retry: 0,
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
