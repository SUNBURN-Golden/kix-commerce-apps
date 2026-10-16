import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { A11Y_BASELINE } from "../../src/a11y-matrix";
import { axeRuleCountForTag, installedAxeVersion, runAxe } from "../../src/a11y-axe";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const doc = fs.readFileSync(path.join(root, "docs/c-a11y-acceptance-stub-apps-bind.md"), "utf8");

describe("automated baseline: tool, version and tags are recorded, and automation is not acceptance", () => {
  const suite = useBrowser();

  it("the pinned version equals the injected axe, the lockfile entry, the e2e package.json and a dated change-log row", async () => {
    const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8")) as { packages: Record<string, { version?: string }> };
    expect(lock.packages["node_modules/axe-core"]?.version).toBe(A11Y_BASELINE.version);
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/e2e/package.json"), "utf8")) as { devDependencies: Record<string, string> };
    expect(pkg.devDependencies["axe-core"]).toBe(A11Y_BASELINE.version);
    expect(installedAxeVersion()).toBe(A11Y_BASELINE.version);
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/");
    const run = await runAxe(page, A11Y_BASELINE.tags);
    expect(run.version).toBe(A11Y_BASELINE.version);
    for (const tag of A11Y_BASELINE.tags) {
      expect(await axeRuleCountForTag(page, tag), `axe ${A11Y_BASELINE.version} has rules for tag ${tag}`).toBeGreaterThan(0);
    }
    const changeLog = doc.split("## Baseline change log")[1] ?? "";
    expect(changeLog, "a change-log row for this version").toMatch(new RegExp(`\\|\\s*\\d{4}-\\d{2}-\\d{2}\\s*\\|\\s*${A11Y_BASELINE.version.replace(/\./g, "\\.")}\\s*\\|`));
    for (const tag of A11Y_BASELINE.tags) {
      expect(doc, `the doc lists tag ${tag}`).toContain(tag);
    }
    expect(A11Y_BASELINE.targetStandard).toBe("UNDETERMINED");
    expect(doc).toContain("UNDETERMINED");
    await suite.pass(page, "a11y.baseline");
    await page.close();
  });
});
