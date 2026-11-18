import { describe, expect, it } from "vitest";
import { useBrowser } from "../../src/suite";
import { engineComposition, confirmation } from "../../src/composition";
import type {} from "../../src/resale-fault-types";
import { runAxe } from "../../src/a11y-axe";
import { A11Y_BASELINE, ratchet } from "../../src/a11y-matrix";
import { tabTo, overflowProblems } from "../../src/a11y-keyboard";
import { poll } from "../../src/desk";
import { openScreen } from "./helpers";

describe("resale market bilingual form and display", () => {
  const suite = useBrowser();
  it.each(["en", "ko"] as const)("keeps return focus visible, continues Tab and announces heading fallback (%s)", async lang => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixResaleFault = { mode: "reject", dispatches: 0, list: { productIds: ["demo-001", "demo-003"], total: 4 } }; });
    for (const size of [{ width: 320, height: 568 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(size);
      await openScreen(page, suite.faultOrigin!, `/resale/market?lang=${lang}&q=object&page=2`, size.width === 320 ? "narrow" : "desktop");
      await page.setViewportSize(size);
      expect(await tabTo(page, '[data-market-product-id="demo-003"]')).toBe(true);
      const saved = await page.evaluate(() => scrollY);
      if (size.width === 320) expect(saved).toBeGreaterThan(0);
      await page.keyboard.press("Enter");
      expect(await tabTo(page, "[data-market-return]")).toBe(true);
      // Reorder a valid two-card response. Identity, rather than index, selects the target.
      await page.evaluate(() => { window.__kixResaleFault!.list!.productIds = ["demo-003", "demo-001"]; });
      await page.keyboard.press("Enter");
      await poll(() => page.locator('[data-market-product-id="demo-003"]:focus').count(), count => count === 1, "reordered card focus");
      expect(await page.locator(".market-card:focus").evaluate(el => getComputedStyle(el).outlineStyle !== "none")).toBe(true);
      expect(await overflowProblems(page, "resale.return.reflow")).toEqual([]);
      await page.keyboard.press("Tab");
      expect(await page.locator('[data-market-product-id="demo-001"]:focus').count()).toBe(1);
      await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Enter");
      await page.evaluate(() => { window.__kixResaleFault!.list!.productIds = ["demo-001"]; });
      expect(await tabTo(page, "[data-market-return]")).toBe(true); await page.keyboard.press("Enter");
      await poll(() => page.evaluate(() => document.activeElement?.id), id => id === "market-results-heading", "localized fallback");
      const heading = page.locator("#market-results-heading");
      expect(await heading.innerText()).toBe(lang === "ko" ? "리셀 마켓" : "Resale market");
      expect(await heading.getAttribute("tabindex")).toBe("-1");
      const axe = await runAxe(page, A11Y_BASELINE.tags);
      expect(ratchet("resale-market", size.width === 320 ? "narrow" : "desktop", axe.violations.map(v => v.ruleId)).unlisted).toEqual([]);
      await page.keyboard.press("Tab"); expect(await page.locator("#market-search:focus").count()).toBe(1);
      await page.evaluate(() => { window.__kixResaleFault!.list!.productIds = ["demo-001", "demo-003"]; });
      await suite.quiet(page, "return accessibility");
    }
    expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
    await page.close();
  });
  it("keeps bilingual exact-unit IME, errors and keyboard review/confirm safe", async () => {
    for (const locale of ["ko", "en"] as const) {
      const page = await suite.newPage();
      await page.addInitScript(() => { window.__kixResaleFault = { mode: "normal", dispatches: 0 }; });
      await openScreen(page, suite.faultOrigin!, `/resale/market/demo-001?lang=${locale}`);
      await page.locator("#market-action").selectOption("bid");
      const input = page.locator("#market-units");
      const review = page.getByRole("button", { name: locale === "ko" ? "모의 거래 검토" : "Review simulation" });
      const error = () => page.locator("#market-units-format-error");
      const errorCopy = (language: "ko" | "en") => language === "ko" ? "숫자로 된 0 이상의 정수를 입력하세요." : "Enter a whole number using digits only (0 or greater).";
      await input.fill("");
      await engineComposition(page, "#market-units", false, async () => {
        await page.locator("#market-trade-form").evaluate(el => (el as HTMLFormElement).requestSubmit());
        expect(await error().count()).toBe(0);
        expect(await input.getAttribute("aria-invalid")).toBe("false");
        expect(await page.locator(".market-review").count()).toBe(0);
        expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
      });
      await input.blur();
      expect(await error().innerText()).toBe(errorCopy(locale));
      expect(await input.getAttribute("aria-invalid")).toBe("true");
      expect(await page.locator(".error-summary:focus").count()).toBe(0);
      await input.fill("01"); await input.blur();
      expect(await input.getAttribute("aria-invalid")).toBe("true");
      expect(await input.getAttribute("aria-describedby")).toBe("market-units-format-error");
      expect(await error().innerText()).toBe(errorCopy(locale));
      const other = locale === "ko" ? "en" : "ko";
      await page.locator(`[data-locale="${other}"]`).click();
      expect(await input.inputValue()).toBe("01");
      expect(await error().innerText()).toBe(errorCopy(other));
      await page.locator(`[data-locale="${locale}"]`).click();
      await review.click(); await page.locator(".error-summary:focus").waitFor();
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("href"))).toBe("#market-units");
      await page.keyboard.press("Enter");
      expect(await page.evaluate(() => document.activeElement?.id)).toBe("market-units");
      const value = "999999999999999999999999999999";
      await input.fill(value);
      expect(await error().count()).toBe(0);
      for (const order of ["key-first", "end-first", "229"] as const) {
        await confirmation(page, "#market-units", order);
        expect(await input.inputValue()).toBe(value);
        expect(await page.locator(".market-review").count()).toBe(0);
        expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
      }
      await input.press("Enter"); await page.locator(".market-review h4:focus").waitFor();
      expect(await page.locator(".market-review p").nth(2).innerText()).toBe(`${value} ${locale === "ko" ? "모의 단위" : "mock units"}`);
      expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
      await page.keyboard.press("Tab"); await page.keyboard.press("Enter"); // Back to edit.
      expect(await input.inputValue()).toBe(value);
      await input.press("Enter"); await page.locator(".market-review h4:focus").waitFor();
      await page.locator(`[data-locale="${other}"]`).click();
      expect(await page.locator(".market-review p").nth(2).innerText()).toBe(`${value} ${other === "ko" ? "모의 단위" : "mock units"}`);
      // Resume at the heading after the locale control; Tab traverses back, then confirm.
      await page.locator(".market-review h4").focus();
      await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.textContent)).toBe(other === "ko" ? "모의 거래 한 번 기록" : "Record simulation once");
      await page.keyboard.press(locale === "ko" ? "Enter" : "Space");
      await page.locator('[data-market-outcome="CONFIRMED"]').waitFor();
      expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(1);
      expect(await page.evaluate(() => window.__kixResaleFault?.requests?.[0])).toMatchObject({ kind: "bid", mockUnits: value });
      expect(await page.locator("#market-offers-rows li").innerText()).toContain(`${value} ${other === "ko" ? "모의 단위" : "mock units"}`);
      // Extend the existing observation rather than adding a matrix cell or keyboard drive.
      if (locale === "en") await suite.pass(page, "a11y.resale-market.ime");
      else await suite.quiet(page, "exact-unit Korean IME and keyboard");
      await page.close();
    }
  });
  it.each(["dark","forced-colors"] as const)("keeps localized chart and history readable under %s at 320px", async scheme => {
    const page = await suite.newPage();
    await page.emulateMedia(scheme === "dark" ? { colorScheme: "dark" } : { forcedColors: "active" });
    await openScreen(page,suite.origin,"/resale/market/demo-001?lang=ko","narrow");
    await page.getByRole("heading",{ name: "체결 내역" }).waitFor();
    expect(await overflowProblems(page,"resale.reflow")).toEqual([]);
    if (scheme === "forced-colors") {
      const colors = await page.getByRole("button",{ name: "모의 거래 검토" }).evaluate(el => ({ text: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor, bodyText: getComputedStyle(document.body).color }));
      expect(colors.text).toBe(colors.bodyText);
      expect(colors.text).not.toBe(colors.background);
    }
    expect(await page.getByRole("img",{ name: "fixture 가격 추이" }).count()).toBe(1);
    await suite.pass(page,`a11y.resale-market.${scheme}`); await page.close();
  });
  it("keeps large-history controls focused, announces ko/en ranges and reflows with axe", async () => {
    const page = await suite.newPage();
    await page.addInitScript(() => { window.__kixResaleFault = { mode: "reject", dispatches: 0, history: { count: 1001, wideCount: 0 } }; });
    await openScreen(page, suite.faultOrigin!, "/resale/market/demo-001");
    const status = page.locator("#market-trades-status");
    expect(await status.getAttribute("aria-live")).toBe("off");
    expect(await tabTo(page, 'nav[aria-describedby="market-trades-status"] button:last-child')).toBe(true);
    await page.keyboard.press("Enter");
    expect(await status.innerText()).toContain("1001–1001 of 1001; page 21 of 21");
    expect(await status.getAttribute("aria-live")).toBe("polite");
    expect(await status.getAttribute("aria-atomic")).toBe("true");
    const last = page.locator('nav[aria-describedby="market-trades-status"] button:last-child');
    expect(await last.getAttribute("aria-disabled")).toBe("true");
    await page.keyboard.press("Space"); expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Last page");
    await page.keyboard.press("Shift+Tab"); expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Next page");
    await page.keyboard.press("Tab"); expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Last page");
    await page.locator('nav[aria-describedby="market-trades-status"] button:first-child').press("Space");
    expect(await status.innerText()).toContain("1–50 of 1001");
    await page.getByLabel("Variant", { exact: true }).focus();
    await page.getByLabel("Variant", { exact: true }).selectOption("wide");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("market-variant");
    expect(await status.innerText()).toContain("Wide: 0–0 of 0; page 0 of 0");
    await page.getByLabel("Variant", { exact: true }).selectOption("standard");
    for (const locale of ["en", "ko"] as const) {
      await page.locator(`[data-locale="${locale}"]`).click();
      expect(await status.innerText()).toContain(locale === "en" ? "Trade history · Standard" : "체결 내역 · 기본");
      for (const media of [{ colorScheme: "dark" as const }, { forcedColors: "active" as const }]) {
        await page.emulateMedia(media);
        await page.setViewportSize({ width: 320, height: 800 });
        expect(await overflowProblems(page, "resale.history.reflow")).toEqual([]);
        const axe = await runAxe(page, A11Y_BASELINE.tags);
        expect(ratchet("resale-product", "narrow", axe.violations.map(v => v.ruleId)).unlisted).toEqual([]);
        await last.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
        expect(await last.evaluate(node => node === document.activeElement && getComputedStyle(node).outlineStyle !== "none")).toBe(true);
        expect(await page.locator("#market-trades-rows tr").count()).toBe(50);
        expect(await page.locator("#market-offers-rows li").count()).toBe(50);
      }
    }
    expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(0);
    await suite.quiet(page, "history pagination bilingual keyboard, axe, reflow"); await page.close();
  });

});
