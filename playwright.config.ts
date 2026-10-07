import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: true,
  use: { browserName: "chromium", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    { command: "npm run dev -w @kix/web -- --host 127.0.0.1 --port 5173", url: "http://127.0.0.1:5173", reuseExistingServer: false,
      env: { VITE_KIX_PROTOCOL_MODE: "stub" } },
    { command: "npm run dev -w @kix/web -- --host 127.0.0.1 --port 5174", url: "http://127.0.0.1:5174", reuseExistingServer: false,
      env: { VITE_KIX_PROTOCOL_MODE: "integration-http", VITE_KIX_PROTOCOL_API_BASE: "http://127.0.0.1:41999" } },
  ],
});
