import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "vite";
import { describe, expect, it } from "vitest";

function exclusionProblems(modules: readonly string[], artifacts: readonly string[]): string[] {
  const problems: string[] = [];
  for (const id of modules) if (id.replaceAll("\\", "/").includes("/src/dev/gallery/")) problems.push(`gallery module: ${id}`);
  for (const content of artifacts) {
    for (const marker of ["/dev/gallery", "component-gallery", "gallery-index", "gallery-synthetic-fault", "evt_gallery_synthetic", "Synthetic Shell specimen"]) {
      if (content.includes(marker)) problems.push(`gallery artifact: ${marker}`);
    }
  }
  return problems;
}

describe("gallery production exclusion", () => {
  it("rejects contaminated module graphs and artifact contents", () => {
    expect(exclusionProblems(["/app/src/dev/gallery/cases.tsx"], [])).toHaveLength(1);
    expect(exclusionProblems([], [".gallery-index{display:grid}"])).toHaveLength(1);
    expect(exclusionProblems([], ['"/dev/gallery"'])).toHaveLength(1);
  });

  it("clean production output includes no gallery module, fixture, route or CSS", async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "kix-gallery-exclusion-"));
    const modules: string[] = [];
    const artifacts: string[] = [];
    const priorNodeEnv = process.env.NODE_ENV;
    const prior = new Map(Object.entries(process.env).filter(([key]) => key.startsWith("VITE_")));
    try {
      process.env.NODE_ENV = "production";
      for (const key of prior.keys()) Reflect.deleteProperty(process.env, key);
      const envDir = path.join(scratch, "env");
      fs.mkdirSync(envDir);
      const root = path.resolve(import.meta.dirname, "..");
      await build({ root, configFile: path.join(root, "vite.config.ts"), mode: "production", envDir, logLevel: "silent",
        build: { outDir: path.join(scratch, "dist"), emptyOutDir: true },
        plugins: [{ name: "inspect-gallery-exclusion", generateBundle(_options, bundle) {
          for (const emitted of Object.values(bundle)) {
            if (emitted.type === "chunk") {
              modules.push(...Object.keys(emitted.modules));
              artifacts.push(emitted.code);
            } else artifacts.push(String(emitted.source));
          }
        } }],
      });
      expect(modules.some((id) => id.includes("src/screens.ts"))).toBe(true);
      expect(artifacts.length).toBeGreaterThan(1);
      expect(exclusionProblems(modules, artifacts)).toEqual([]);
    } finally {
      if (priorNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
      else process.env.NODE_ENV = priorNodeEnv;
      for (const [key, value] of prior) process.env[key] = value;
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  }, 120_000);
});
