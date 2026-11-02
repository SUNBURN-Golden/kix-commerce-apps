import type {} from "../../shell-fixtures/marketing-session";
import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { A11Y_BASELINE } from "../../src/a11y-matrix";
import { runAxe } from "../../src/a11y-axe";
import { tabTo } from "../../src/a11y-keyboard";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

async function key(page: Page, selector: string, press = "Enter") {
  expect(await tabTo(page, selector)).toBe(true);
  await page.keyboard.press(press);
}
async function scan(page: Page) {
  const result = await runAxe(page, A11Y_BASELINE.tags);
  expect(result.violations.map((row) => row.ruleId)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

describe("marketing session depth: isolated fixtures, keyboard and announcements", () => {
  const suite = useBrowser();
  it("M01 unknown knowledge needs an explicit recovery; read again preserves it", async () => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixMarketingFixture = "unknown"; });
    await openScreen(page, suite.faultOrigin!, "/marketing/m01", "narrow");
    const unknown = page.locator('[data-async-state="unknown"]');
    await unknown.waitFor();
    expect(await unknown.getAttribute("aria-live")).toBeNull(); // The card parent owns this update.
    expect(await unknown.locator("xpath=..").getAttribute("aria-live")).toBe("polite");
    await key(page, 'main section > button');
    expect(await unknown.count()).toBe(1);
    await scan(page);
    await key(page, '#membership-form button.ghost', "Space");
    await page.locator("#m01-card-empty").waitFor();
    expect(await unknown.count()).toBe(0);
    await suite.pass(page, "a11y.marketing-depth.membership-unknown");
    await page.close();
  });

  it("M02 lifecycle has one announcement owner and re-entry works by keys", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/marketing/m01", "narrow");
    await page.locator("#membership-name").fill("Depth fan");
    await key(page, '#membership-form button[type="submit"]');
    await key(page, 'main a[href="/marketing/m02"]');
    await page.locator(".program li button").first().waitFor();
    await key(page, '.program li:first-child button');
    const status = page.locator("#m02-interest-evt_lanterns");
    expect(await status.getAttribute("aria-live")).toBe("polite");
    expect(await status.locator('[aria-live], [role="status"]').count()).toBe(0);
    expect(await status.evaluate((node) => node === document.activeElement)).toBe(true);
    await key(page, '.program li:first-child button:last-child', "Space");
    await page.waitForFunction(() => document.getElementById("m02-interest-evt_lanterns")?.textContent?.includes("Withdrawn"));
    expect(await page.locator('.program li:first-child button').isEnabled()).toBe(true);
    await scan(page);
    await key(page, '.program li:first-child button');
    await page.waitForFunction(() => document.getElementById("m02-interest-evt_lanterns")?.textContent?.includes("Interest recorded"));
    await key(page, 'main a[href="/marketing"]');
    const facts = page.locator("#marketing-session-facts");
    expect(await facts.innerText()).toContain("fan");
    await key(page, 'main a[href="/marketing/m02"]');
    await page.locator("#m02-interest-evt_lanterns p").waitFor();
    expect(await page.locator("#m02-interest-evt_lanterns").innerText()).toContain("Interest recorded");
    await suite.quiet(page, "navigation retains marketing session");
    await page.reload();
    await page.locator(".program li button").first().waitFor();
    expect(await page.locator("#m02-interest-evt_lanterns p").count()).toBe(0);
    expect(await page.locator(".program li button").first().isDisabled()).toBe(true);
    await suite.pass(page, "a11y.marketing-depth.presale-lifecycle");
    await page.close();
  });

  it("M02 closed/unknown fixture windows refuse and stay distinct from unknown responses", async () => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixMarketingFixture = "windows"; });
    await openScreen(page, suite.faultOrigin!, "/marketing/m01", "narrow");
    await page.locator("#membership-name").fill("Depth fan");
    await key(page, '#membership-form button[type="submit"]');
    await key(page, 'main a[href="/marketing/m02"]');
    await page.locator("#m02-window-evt_lanterns").waitFor();
    expect(await page.locator("#m02-window-evt_lanterns").innerText()).toContain("closed");
    expect(await page.locator("#m02-window-evt_paper_orchestra").innerText()).toContain("unknown");
    expect(await page.locator('.program button:enabled').count()).toBe(0);
    await scan(page);
    await suite.pass(page, "a11y.marketing-depth.presale-windows");
    await page.close();
  });

  it("M03 fixed clock reaches exclusive expiry as history without mutating on read", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.faultOrigin!, "/marketing/m03", "narrow");
    await page.locator("#coupon-code").fill("DEMO-BOUNDARY");
    await key(page, '#coupon-form button[type="submit"]');
    await page.locator('[data-coupon-state="valid"]').waitFor();
    await page.evaluate(() => { window.__kixMarketingNow = "2026-10-30T00:01:00.000Z"; });
    await key(page, 'main section > button');
    await page.locator('[data-coupon-state="expired"]').waitFor();
    expect(await page.locator('.program').innerText()).toContain("Attached");
    expect(await page.locator('[data-coupon-state="expired"]').innerText()).toContain("history");
    await scan(page);
    await page.locator("#coupon-code").fill("DEMO-GROUP-A");
    await key(page, '#coupon-form button[type="submit"]');
    await page.locator("#coupon-code").fill("DEMO-GROUP-B");
    await key(page, '#coupon-form button[type="submit"]');
    expect(await page.locator("#coupon-refusal").innerText()).toContain("conflict");
    expect(await page.locator('#coupon-form button').getAttribute("aria-describedby")).toContain("coupon-refusal");
    await suite.pass(page, "a11y.marketing-depth.coupon-expiry-conflict");
    await page.close();
  });

  it("M04 source attribution refuses unknown and duplicate without changing count", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.faultOrigin!, "/marketing/m04", "narrow");
    for (const code of ["REF-STUB-UNATTRIBUTED", "REF-STUB-HALL", "REF-STUB-HALL"]) {
      await page.locator("#referral-code").fill(code);
      await key(page, '#referral-form button[type="submit"]');
    }
    expect(await page.locator('.ticket dd').first().innerText()).toBe("1");
    expect(await page.locator('.program').innerText()).toContain("synthetic:REF-STUB-HALL");
    expect(await page.locator("#referral-refusal").innerText()).toContain("already counted");
    await scan(page);
    await suite.pass(page, "a11y.marketing-depth.referral-attribution");
    await page.close();
  });

  it("empty fixture catalogue and Korean local knowledge keep labels and have no new axe findings", async () => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixMarketingFixture = "empty"; });
    await openScreen(page, suite.faultOrigin!, "/marketing/m03?lang=ko", "narrow");
    expect(await page.locator('main').innerText()).toContain("사용 가능한 로컬 fixture가 없습니다.");
    await scan(page);
    await suite.quiet(page, "empty Korean fixtures");
    await page.close();
    const unknown = await suite.newPage();
    await unknown.addInitScript(() => { window.__kixMarketingFixture = "unknown"; });
    await openScreen(unknown, suite.faultOrigin!, "/marketing/m01?lang=ko", "narrow");
    expect(await unknown.locator('[data-async-state="unknown"]').innerText()).toContain("멤버십 정보가 미확인");
    expect(await unknown.locator('main').innerText()).toContain("설계중");
    await scan(unknown);
    await suite.pass(unknown, "a11y.marketing-depth.ko-empty-unknown");
    await unknown.close();
  });
});
