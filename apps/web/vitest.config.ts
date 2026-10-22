import { AsyncStateReporter } from "./test/support/async-state-reporter";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const appDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@kix/protocol-adapter": path.resolve(appDir, "../../packages/protocol-adapter/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    environmentOptions: { jsdom: { url: "http://127.0.0.1:5173" } },
    reporters: ["default", new AsyncStateReporter()],
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    // Every screen is imported before a test file runs, so a synchronous render sees the screen, not the loading note.
    setupFiles: ["./test/support/preload-screens.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      reportDir: "coverage",
      reportOnFailure: true,
      include: ["src/**/*.{ts,tsx}"],
    },
  },
});
