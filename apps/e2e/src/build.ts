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
    build: { outDir, emptyOutDir: true, minify: true },
  });
  return { outDir, cleanup: () => fs.rmSync(scratch, { recursive: true, force: true }) };
}
