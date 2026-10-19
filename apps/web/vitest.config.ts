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
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    // Every screen is imported before a test file runs, so a synchronous render sees the screen, not the loading note.
    setupFiles: ["./test/support/preload-screens.ts"],
  },
});
