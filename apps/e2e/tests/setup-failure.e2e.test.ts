import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";
import { describe, expect, it, vi } from "vitest";
import { recordCheck } from "../src/run-record";

vi.mock("../src/build", () => ({
  buildStubApp: async () => { throw new Error("deliberate build failure"); },
  buildShellFaultApp: vi.fn(),
  buildGalleryApp: vi.fn(),
  webRoot: "/unused",
}));

// The locked Vitest 3.2.7 API returns every final test in global teardown. A setup failure has none.
const project = { vitest: { state: { getTestModules: () => [] } }, provide: vi.fn() } as unknown as TestProject;

const cases = [
  ["journeys", "KIX_E2E_RECORD_OUT", () => import("../src/global-setup")],
  ["a11y", "KIX_A11Y_RECORD_OUT", () => import("../src/a11y-global-setup")],
  ["visual", "KIX_VISUAL_RECORD_OUT", () => import("../src/visual-global-setup")],
  ["budget", "KIX_BUDGET_RECORD_OUT", () => import("../src/budget-global-setup")],
] as const;

describe("early failure diagnostics", () => {
  for (const [name, key, load] of cases) {
    it(`${name} emits diagnostics and cleans up even when the build fails before a browser opens`, async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kix-setup-failure-"));
      const original = { out: process.env[key], record: process.env.KIX_E2E_RECORD_DIR, update: process.env.KIX_VISUAL_UPDATE };
      const out = path.join(dir, "record.json");
      try {
        process.env[key] = out;
        delete process.env.KIX_VISUAL_UPDATE;
        const module = await load();
        await expect(module.setup(project)).rejects.toThrow(/Setup failed/);
        const record = JSON.parse(fs.readFileSync(out, "utf8"));
        expect(record.timing).toMatchObject({ count: 0, measured: 0, tests: [] });
        expect(record.lifecycle).toMatchObject({ sessions: 0, testsTracked: 0, tests: [], files: [] });
        expect(fs.existsSync(process.env.KIX_E2E_RECORD_DIR!)).toBe(false);
        if (name === "visual") expect(record).toMatchObject({ profile: "unavailable", cjkGlyphs: "unavailable", shots: [] });
        if (name === "budget") expect(record).toMatchObject({ split: null, render: [] });
      } finally {
        for (const [env, value] of [[key, original.out], ["KIX_E2E_RECORD_DIR", original.record], ["KIX_VISUAL_UPDATE", original.update]]) {
          if (value === undefined) Reflect.deleteProperty(process.env, env!);
          else process.env[env!] = value;
        }
        fs.rmSync(dir, { recursive: true, force: true });
      }
      recordCheck("harness.records");
    });
  }
});
