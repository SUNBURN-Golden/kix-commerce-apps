import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { A11Y_BASELINE, STATIC_CHECK_IDS, ratchet } from "../../src/a11y-matrix";
import { runAxe } from "../../src/a11y-axe";
import { tabTo } from "../../src/a11y-keyboard";
import { recordFacet } from "../../src/a11y-record";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";
import { SCREEN_STATE_MATRIX } from "../../../web/src/async-state/matrix";

declare global {
  interface Window {
    __kixAsyncReadMode?: "held" | "error" | "empty" | "normal";
    __kixAsyncReads?: number;
    __kixAsyncReleaseRead?: () => void;
  }
}

async function scan(page: Page, screenId: string, state: string) {
  const axe = await runAxe(page, A11Y_BASELINE.tags);
  const result = ratchet(screenId, "desktop", axe.violations.map((violation) => violation.ruleId));
  expect(result.unlisted, `new axe violations in ${state}`).toEqual([]);
  expect(result.vanished, `fixed findings in ${state}`).toEqual([]);
  recordFacet({ kind: "observation", id: `async.${state}`, note: `Synthetic alternate state; axe incomplete ${axe.incomplete.length}. No user acceptance or assistive technology run.` });
}

describe("shared async states on real screens (synthetic local reads)", () => {
  const suite = useBrowser();

  it("normal, held read, error, one keyboard read and empty remain distinct", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/discovery");
    await page.locator('[data-catalog="ready"]').waitFor();
    expect(await page.locator('[data-catalog="ready"]').innerText()).toContain("source stub-shape");
    await suite.quiet(page, "normal discovery");
    await page.addInitScript(() => { window.__kixAsyncReadMode = "held"; });
    await openScreen(page, suite.faultOrigin!, "/discovery");
    const loading = page.locator('[data-catalog="loading"] [data-async-state="loading"]');
    await loading.waitFor();
    expect(await loading.getAttribute("aria-busy")).toBe("true");
    expect(await loading.getAttribute("aria-live")).toBe("polite");
    expect(await loading.getAttribute("role")).toBe("status");
    const initialReads = await page.evaluate(() => window.__kixAsyncReads ?? 0);
    expect(initialReads).toBeGreaterThan(0); // The harness may retain React StrictMode's initial effect probe.
    await scan(page, "discovery", "loading");
    await page.evaluate(() => window.__kixAsyncReleaseRead?.());
    const error = page.locator('[data-catalog="error"] [data-async-state="error"]');
    await error.waitFor();
    expect(await error.getAttribute("role")).toBe("alert");
    expect(await error.getAttribute("aria-live")).toBe("assertive");
    expect(await error.getAttribute("aria-busy")).toBe("false");
    expect(await error.innerText()).toContain("Synthetic catalogue read fault");
    expect(await error.locator('a[href="/help"]').count()).toBe(1);
    expect(await error.locator("button").getAttribute("type")).toBe("button");
    await scan(page, "discovery", "error");
    await page.evaluate(() => { window.__kixAsyncReadMode = "empty"; });
    expect(await tabTo(page, '[data-catalog="error"] button')).toBe(true);
    await page.keyboard.press("Enter");
    await page.locator('[data-catalog="empty"] [data-async-state="empty"]').waitFor();
    expect(await page.evaluate(() => window.__kixAsyncReads)).toBe(initialReads + 1);
    expect(await page.locator('[data-catalog="empty"] [data-async-state="empty"]').getAttribute("role")).toBe("status");
    expect(await page.locator('[data-catalog="empty"] [aria-busy="true"]').count()).toBe(0);
    await scan(page, "discovery", "empty");
    await suite.pass(page, "a11y.async.read-states");
    await page.close();
  });

  it("effect-driven empty catalogue states are checked on their owning routes", async () => {
    for (const route of ["/marketing/m02", "/booking/evt_missing"] as const) {
      const page = await suite.newPage();
      await page.addInitScript(() => { window.__kixAsyncReadMode = "empty"; });
      await openScreen(page, suite.faultOrigin!, route);
      await page.locator("p.empty, [data-async-state='empty']").first().waitFor();
      expect(await page.evaluate(() => window.__kixAsyncReads ?? 0)).toBeGreaterThan(0);
      expect(await page.getByRole("alert").count()).toBe(0);
      await suite.quiet(page, `empty ${route}`);
      await page.close();
    }
    const browserCells = SCREEN_STATE_MATRIX.flatMap((cell) => cell.check && "browser" in cell.check ? [cell.check.browser] : []);
    expect([...new Set(browserCells)].sort()).toEqual(["a11y.async.catalogue-empty", "a11y.async.refund-stale"]);
    expect(STATIC_CHECK_IDS).toContain("a11y.async.catalogue-empty");
    const page = await suite.newPage();
    await suite.pass(page, "a11y.async.catalogue-empty");
    await page.close();
  });

  it("the box-office refund desk shows STALE on its own route after a synthetic read", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/");
    await page.getByRole("button", { name: "Mock settlement", exact: true }).first().press("Enter");
    await page.locator(".refund-scenario select").selectOption("stale");
    await page.locator('[data-refund-state="stale"]').waitFor();
    expect(await page.locator('[data-refund-state="stale"]').innerText()).toContain("Stale refund read");
    await suite.pass(page, "a11y.async.refund-stale");
    await page.close();
  });

  it("UNKNOWN keeps its subject fenced after an explicit fresh read and has no recovery button", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/session");
    await page.getByLabel("Scenario", { exact: true }).selectOption("attach-lost");
    await page.getByRole("button", { name: "Start new source with this scenario" }).press("Enter");
    const attach = page.locator("#session-attach-obs-0001");
    await page.waitForFunction(() => !(document.getElementById("session-attach-obs-0001") as HTMLButtonElement | null)?.disabled);
    await attach.press("Enter");
    const unknown = page.locator('[data-async-state="unknown"]').first();
    await unknown.waitFor();
    const owner = page.locator("#session-status");
    expect(await owner.getAttribute("role")).toBe("status");
    expect(await owner.getAttribute("aria-live")).toBe("polite");
    expect(await owner.getAttribute("aria-busy")).toBe("false");
    expect(await unknown.getAttribute("role")).toBeNull();
    expect(await unknown.getAttribute("aria-live")).toBeNull(); // The existing status owner announces this update once.
    expect(await unknown.innerText()).toContain("may have applied");
    expect(await unknown.innerText()).not.toMatch(/success|failed|completed/);
    expect(await unknown.locator("button").count()).toBe(0);
    const before = await page.locator('[data-outcome="UNKNOWN"]').count();
    expect(before).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Read again", exact: true }).press("Enter");
    await page.waitForFunction(() => document.querySelector('[data-outcome="UNKNOWN"]') !== null);
    expect(await page.locator('[data-outcome="UNKNOWN"]').count()).toBe(before);
    expect(await attach.isDisabled()).toBe(true);
    expect(await tabTo(page, '[data-async-state="unknown"] a[href="/receipts"]')).toBe(true);
    await page.keyboard.press("Enter");
    await page.waitForURL("**/receipts");
    await suite.pass(page, "a11y.async.unknown-fence");
    await page.close();
  });

  for (const preference of ["dark", "forced-colors"] as const) {
    it(`${preference}: rendered UNKNOWN and error keep different borders and readable tokens`, async () => {
      const page = await suite.newPage();
      await page.emulateMedia(preference === "dark" ? { colorScheme: "dark" } : { forcedColors: "active" });
      await openScreen(page, suite.origin, "/journeys");
      const unknown = page.locator('[data-async-state="unknown"]').first();
      await unknown.waitFor();
      const probe = (node: Element) => {
        const style = getComputedStyle(node);
        return { border: style.borderTopStyle, color: style.color, background: style.backgroundColor, adjust: style.forcedColorAdjust, wordBorder: getComputedStyle(node.querySelector('[data-status-mark]')!).borderTopStyle };
      };
      const u = await unknown.evaluate(probe);
      expect(u.border).toBe("double");
      expect(u.wordBorder).toBe("double");
      expect(u.color).not.toBe(u.background);
      expect(u.adjust).toBe("auto");
      await suite.quiet(page, `UNKNOWN ${preference}`);
      await page.addInitScript(() => { window.__kixAsyncReadMode = "error"; });
      await openScreen(page, suite.faultOrigin!, "/discovery");
      const error = page.locator('[data-async-state="error"]').first();
      await error.waitFor();
      const e = await error.evaluate(probe);
      expect(e.border).toBe("solid");
      expect(e.border).not.toBe(u.border);
      expect(e.color).not.toBe(e.background);
      expect(e.adjust).toBe("auto");
      expect(await error.getAttribute("role")).toBe("alert");
      await suite.pass(page, `a11y.async.${preference}`);
      await page.close();
    });
  }
});
