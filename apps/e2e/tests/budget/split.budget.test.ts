import { describe, expect, inject, it } from "vitest";
import { recordLine } from "../../src/budget-record";
import { useBrowser } from "../../src/suite";
import { distScripts, gzipOf, openHome, readLimits, stem, trackScripts } from "./helpers";

/** Screens whose chunk must not be requested while the box office or the gift screen is open. */
const UNRELATED = ["Admission", "Assistant", "Credit", "CreditOrigination", "CreditServicing", "Finance", "Notifications", "TenantPermissions", "PlatformRelease", "OperationalQualification", "Merchant"];

describe("route split holds at runtime (stub, headless Chrome)", () => {
  const suite = useBrowser();
  const distDir = inject("distDir");
  const limits = readLimits(inject("budgetFile"));
  const all = distScripts(distDir);

  it("the box office load requests the landing set only, at most the landing limit in gzip bytes", async () => {
    const page = await suite.newPage();
    const seen = trackScripts(page);
    await openHome(page, suite.origin);
    const landing = [...seen];
    const bytes = landing.reduce((total, file) => total + gzipOf(distDir, file), 0);
    expect(landing.length, "the landing load requested some script").toBeGreaterThan(0);
    expect(landing.length, "the landing load requested a minority of the emitted scripts").toBeLessThan(all.length / 2);
    for (const name of UNRELATED) {
      expect(landing.map(stem), `${name} chunk requested on /`).not.toContain(name);
    }
    expect(bytes, `landing JS gzip bytes ${bytes} against the limit`).toBeLessThanOrEqual(limits.landingJsGzip);
    recordLine("split.jsonl", { landingJsGzip: bytes, landingJsFiles: landing.length });
    await suite.pass(page, "budget.split.landing");
    await page.close();
  });

  it("opening /gift by a full load requests the gift chunk and no unrelated screen's chunk", async () => {
    const page = await suite.newPage();
    const seen = trackScripts(page);
    await page.goto(suite.origin + "/gift");
    await page.getByRole("heading", { name: "Gift transfer", level: 2 }).waitFor();
    const names = [...seen].map(stem);
    expect(names).toContain("Gift");
    for (const name of UNRELATED) {
      expect(names, `${name} chunk requested on /gift`).not.toContain(name);
    }
    expect(seen.size, "a minority of the emitted scripts").toBeLessThan(all.length / 2);
    await suite.pass(page, "budget.split.gift");
    await page.close();
  });
});
