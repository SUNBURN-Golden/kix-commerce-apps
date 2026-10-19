import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
export const webRoot = path.resolve(here, "../../web");

export interface BuiltApp {
  outDir: string;
  cleanup: () => void;
}

/**
 * Builds a clean production bundle of apps/web in stub mode.
 * Every VITE_* variable is removed and envDir points at an empty directory,
 * so a stray .env file or shell variable cannot select HTTP mode.
 */
export async function buildStubApp(): Promise<BuiltApp> {
  return buildApp(false);
}

/**
 * A second stub build for the shell-resilience browser tests only. Two aliases swap the receipts screen and
 * the protocol port for fixtures that throw on purpose while a window flag is set. The product bundle that
 * every other test uses is not touched.
 */
export async function buildShellFaultApp(): Promise<BuiltApp> {
  return buildApp(true);
}

async function buildApp(withFaults: boolean): Promise<BuiltApp> {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("VITE_")) {
      delete process.env[key];
    }
  }
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "kix-e2e-"));
  const envDir = path.join(scratch, "env");
  const outDir = path.join(scratch, "dist");
  fs.mkdirSync(envDir);
  await build({
    root: webRoot,
    configFile: path.join(webRoot, "vite.config.ts"),
    envDir,
    mode: "production",
    logLevel: "warn",
    resolve: withFaults
      ? {
          alias: [
            { find: /^\.\/pages\/Receipts$/, replacement: path.resolve(here, "../shell-fixtures/receipts-fault.ts") },
            { find: /^(\.\.?\/)+protocol$/, replacement: path.resolve(here, "../shell-fixtures/protocol-fault.ts") },
          ],
        }
      : undefined,
    build: { outDir, emptyOutDir: true, minify: true },
  });
  if (process.env.KIX_E2E_AXE_SOURCE) {
    fs.copyFileSync(process.env.KIX_E2E_AXE_SOURCE, path.join(outDir, "axe.min.js"));
  }
  return { outDir, cleanup: () => fs.rmSync(scratch, { recursive: true, force: true }) };
}
