import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Preserve the existing size limits as app-wide connectivity adds shell code.
  build: { minify: "terser" },
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
