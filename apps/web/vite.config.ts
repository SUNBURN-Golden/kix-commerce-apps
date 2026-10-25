import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Preserve the existing size limits as app-wide connectivity adds shell code.
  build: {
    minify: "terser",
    rollupOptions: {
      output: {
        // Related desk copy shares vocabulary. Compress these lazy catalogues together
        // without pulling its dependencies (or either screen) into the entry bundle.
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (/\/src\/i18n\/messages\/(credit-(origination|servicing)|pages--Credit(Origination|Servicing)(Panels)?)\.ts$/.test(id)) return "credit-read-copy";
          if (/\/src\/i18n\/messages\/((platform|provider)-journey|pages--(Platform|ProviderJourney)(Panels)?)\.ts$/.test(id)) return "journey-read-copy";
        },
      },
    },
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
