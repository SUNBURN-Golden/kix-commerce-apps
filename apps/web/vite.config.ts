import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Preserve the existing size limits for the localized stub bundle.
  build: {
    minify: "terser",
    // Revisit expressions exposed by the first pass without changing compression safety defaults.
    terserOptions: { compress: { passes: 2 } },
  },
  resolve: {
    alias: {
      "@kix/protocol-adapter": path.resolve(appDir, "../../packages/protocol-adapter/src/index.ts"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
