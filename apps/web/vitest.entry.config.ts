import { defineConfig } from "vitest/config";

// A fresh module graph: the regular screen setup deliberately imports the full catalogue.
export default defineConfig({
  test: { environment: "node", include: ["test/cold/**/*.test.ts"] },
});
