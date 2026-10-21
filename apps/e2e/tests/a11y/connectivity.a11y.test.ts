import { describe, expect, it } from "vitest";
import { A11Y_BASELINE, ratchet } from "../../src/a11y-matrix";
import { runAxe } from "../../src/a11y-axe";
import { tabTo } from "../../src/a11y-keyboard";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

describe("connectivity keyboard and announcements (stub)", () => {
  const suite = useBrowser();
  it("keeps focus, drafts, polite announcements and disabled reasons at 320px; Enter and Space send nothing", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/booking/evt_lanterns", "narrow");
    await page.locator("#booking-place").waitFor();
    expect(await tabTo(page, "#booking-place")).toBe(true);
    await suite.session().context.setOffline(true);
    await page.locator('[data-connectivity-state="offline"]').waitFor();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("booking-place");
    expect(await page.locator("#booking-place").getAttribute("aria-disabled")).toBe("true");
    expect(await page.locator("#booking-place").getAttribute("aria-describedby")).toContain("connectivity-write-reason");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    expect(await page.locator("#booking-confirm").count()).toBe(0);
    await page.locator("#booking-quantity").fill("2");
    await page.locator("#booking-quantity").press("Enter");
    expect(await page.locator("#booking-quantity").inputValue()).toBe("2");
    expect(await page.locator("#booking-confirm").count()).toBe(0);
    // Reconnect enables the local axe script load; it does not replay or refresh business reads.
    await suite.session().context.setOffline(false);
    await page.locator('[data-connectivity-state="local"]').waitFor();
    expect(await page.locator("#booking-place").getAttribute("aria-disabled")).toBe("true");
    const scan = await runAxe(page, A11Y_BASELINE.tags);
    expect(ratchet("booking", "narrow", scan.violations.map((rule) => rule.ruleId)).unlisted).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await suite.pass(page, "a11y.connectivity.keyboard-cached");
    await page.close();
  });
});
