import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { ROUTES, ROUTE_ALIASES } from "../../../web/src/shell/route-registry";
import { SCREENS, VIEWPORTS } from "../../src/a11y-matrix";
import { formProblems, overflowProblems } from "../../src/a11y-keyboard";
import { recordFacet } from "../../src/a11y-record";
import { keyboardOnly } from "../../src/keyboard-guard";
import { runStep, fenceProblems } from "../../src/keyboard-probes";
import { useBrowser } from "../../src/suite";
import { installTextSpacing, probeTextSpacing, type TextSpacingObservation } from "../../src/text-spacing";
import { SPACING_LOCALES, spacingCheckId } from "../../src/text-spacing-matrix";
import { openScreen } from "./helpers";

async function ready(page: Page, locale: string) {
  await page.waitForFunction((lang) => document.documentElement.lang === lang, locale);
  expect(await page.locator(`.locale-switch button[data-locale="${locale}"]`).getAttribute("aria-pressed")).toBe("true");
  expect(await page.locator(".nav-toggle").innerText()).toBe(locale === "ko" ? "메뉴" : "Menu");
  await page.locator('#desk-main h1, #desk-main h2').first().waitFor();
  await installTextSpacing(page);
}

async function observe(page: Page, row: Pick<TextSpacingObservation, "checkId" | "routeId" | "path" | "locale" | "state">) {
  const measured = await probeTextSpacing(page);
  await page.evaluate(async () => { window.scrollTo(0, window.scrollY); await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  if ((await overflowProblems(page, "spacing.document-overflow")).length) measured.problems.push({ code: "spacing.document-overflow", target: "tab-walk" });
  recordFacet({ kind: "spacing", observation: { ...row, ...measured, viewport: VIEWPORTS.narrow, result: measured.problems.length ? "FINDING" : "OBSERVED" } });
  expect(measured.textNodesChecked).toBeGreaterThan(0);
  expect(measured.controlsChecked).toBeGreaterThan(0);
  expect(measured.problems).toEqual([]);
}

const key = async (page: Page, selector: string, press = "Enter") => {
  await runStep(page, { tabTo: selector });
  await page.keyboard.press(press);
};

describe("synthetic text spacing at 320px (no acceptance or conformance claim)", () => {
  const suite = useBrowser();
  it("has exactly 40 production routes × two locales, registry samples and the separate concrete alias", () => {
    expect(ROUTES).toHaveLength(40);
    expect(SCREENS.map((s) => [s.screenId, s.pattern, s.path]).sort()).toEqual(ROUTES.map((r) => [r.id, r.path, r.sample]).sort());
    const ids = SCREENS.flatMap((s) => SPACING_LOCALES.map((l) => spacingCheckId(s.screenId, l)));
    expect(ids).toHaveLength(80);
    expect(new Set(ids).size).toBe(80);
    expect(ROUTE_ALIASES).toEqual([{ path: "/discovery/:rowId", of: "/discovery", sample: "/discovery/row_1" }]);
  });
  for (const screen of SCREENS) {
    it(`${screen.screenId}: ko/en visible text, controls and keyboard scroll regions`, async () => {
      const guard = await keyboardOnly(await suite.newPage());
      const page = guard.page;
      for (const locale of SPACING_LOCALES) {
        const path = `${screen.path}?lang=${locale}`;
        await openScreen(page, suite.origin, path, "narrow");
        await ready(page, locale);
        const checkId = spacingCheckId(screen.screenId, locale);
        await observe(page, { checkId, routeId: screen.screenId, path: screen.path, locale, state: "default" });
        await guard.assertNoPointer();
        await suite.pass(page, checkId);
      }
      await page.close();
    });
  }
  for (const locale of SPACING_LOCALES) {
    for (const variant of ["discovery-alias", "menu-open"] as const) {
      it(`${variant}.${locale}`, async () => {
        const guard = await keyboardOnly(await suite.newPage()); const page = guard.page;
        const path = variant === "discovery-alias" ? ROUTE_ALIASES[0].sample : "/";
        await openScreen(page, suite.origin, `${path}?lang=${locale}`, "narrow");
        await ready(page, locale);
        if (variant === "menu-open") { await key(page, ".nav-toggle"); expect(await page.locator("#surface-menu").getAttribute("data-open")).toBe("true"); }
        const checkId = spacingCheckId(variant, locale);
        await observe(page, { checkId, routeId: variant === "menu-open" ? "box-office" : "discovery", path, locale, state: variant === "menu-open" ? "menu-open" : "default" });
        await guard.assertNoPointer(); await suite.pass(page, checkId); await page.close();
      });
    }
    it(`booking-validation.${locale}: repeated invalid submits send zero and keyboard correction remains editable`, async () => {
      const raw = await suite.newPage();
      await raw.addInitScript(() => { window.__kixFormDeferred = { attempts: 0 }; });
      // State setup before keyboard guard: native input replacement is not part of the Tab observation.
      await openScreen(raw, suite.faultOrigin!, `/booking/evt_lanterns?lang=${locale}`, "narrow");
      await ready(raw, locale);
      await raw.locator("#booking-quantity").fill("1.5");
      const guard = await keyboardOnly(raw); const page = guard.page;
      for (let i = 0; i < 2; i++) {
        await key(page, "#booking-place");
        expect(await page.locator(".error-summary").evaluate((el) => el === document.activeElement)).toBe(true);
        await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
        expect(await formProblems(page, "booking-quantity")).toEqual([]);
      }
      expect(await page.evaluate(() => window.__kixFormDeferred?.attempts)).toBe(0);
      expect(await page.locator(".field-error").count()).toBeGreaterThan(0);
      const checkId = spacingCheckId("booking-validation", locale);
      await observe(page, { checkId, routeId: "booking", path: "/booking/evt_lanterns", locale, state: "validation" });
      await runStep(page, { tabTo: "#booking-quantity" }); await page.keyboard.type("2");
      expect(await page.locator("#booking-quantity").inputValue()).toBe("2");
      expect(await page.locator("#booking-quantity").getAttribute("aria-invalid")).toBe("false");
      expect(await page.evaluate(() => window.__kixFormDeferred?.attempts)).toBe(0);
      await guard.assertNoPointer(); await suite.pass(page, checkId); await page.close();
    });
    it(`session-unknown.${locale}: explanation, fence, sent count and receipts remain available`, async () => {
      const raw = await suite.newPage();
      await openScreen(raw, suite.origin, `/session?lang=${locale}`, "narrow"); await ready(raw, locale);
      await raw.locator("main select").selectOption("attach-lost");
      // Use stable scenario value for setup; all activation and reachability below use keys.
      const guard = await keyboardOnly(raw); const page = guard.page;
      await key(page, 'main button:has-text("Start new source with this scenario"), main button:has-text("이 시나리오로 새")');
      await page.waitForFunction(() => !(document.getElementById("session-attach-obs-0001") as HTMLButtonElement)?.disabled);
      await key(page, "#session-attach-obs-0001");
      await page.locator('li[data-kind="unknown"]').waitFor();
      await page.locator('[data-async-state="unknown"]').first().waitFor();
      expect(await fenceProblems(page, "#session-attach-obs-0001")).toEqual([]);
      for (const press of ["Enter", "Space", "Enter"]) await key(page, "#session-attach-obs-0001", press);
      // Existing in-process source counters displayed by the desk, not a network-only assertion.
      const counters = await page.locator('#session-status p[aria-live="off"]').allTextContents();
      expect(counters.join(" ")).toMatch(/Sent 1 in this load|이번 로드 전송 1/);
      expect(counters.join(" ")).toMatch(/Blocked before sending 3|전송 전 차단 3/);
      await key(page, locale === "ko" ? 'main button:text-is("다시 조회")' : 'main button:text-is("Read again")');
      await page.locator('#session-status[aria-busy="false"]').waitFor();
      await page.locator('li[data-kind="unknown"]').waitFor();
      expect((await page.locator('#session-status p[aria-live="off"]').allTextContents()).join(" ")).toMatch(/Sent 1 in this load|이번 로드 전송 1/);
      expect(await fenceProblems(page, "#session-attach-obs-0001")).toEqual([]);
      await page.locator("#session-attach-obs-0001-reason").waitFor();
      const checkId = spacingCheckId("session-unknown", locale);
      await observe(page, { checkId, routeId: "session", path: "/session", locale, state: "unknown" });
      await runStep(page, { tabTo: 'main a[href="/receipts"]' });
      await guard.assertNoPointer(); await suite.pass(page, checkId); await page.close();
    });
  }
  it("qualifies clipping, occlusion, unreachable scroll detection and clean twins without document overflow", async () => {
    const page = await suite.newPage(); await page.setViewportSize(VIEWPORTS.narrow);
    const html = (broken: boolean) => `<style>body{margin:8px}button{font:inherit}button:focus,[tabindex]:focus{outline:2px solid} .box{width:200px;${broken ? "height:12px;overflow:hidden" : ""}} #scroller{width:180px;height:65px;overflow:auto} #wide{width:600px;height:150px} #cover{position:absolute;inset:0;background:white} #wrap{position:relative;width:180px}</style><label id="fixture-label" class="box" style="display:block">A deliberately wrapping visible label with several words</label><p id="fixture-error" class="box" role="alert">Validation error and UNKNOWN status explanation with several lines</p><div id="wrap"><button id="fixture-control">Reach control</button>${broken ? '<div id="cover"></div>' : ''}</div><div id="scroller" role="region" aria-label="Fixture scroll" ${broken ? '' : 'tabindex="0"'}><div id="wide">Scrollable content ending here</div></div>`;
    await page.setContent(html(true)); await installTextSpacing(page);
    expect(await overflowProblems(page, "fixture-width")).toEqual([]);
    const broken = await probeTextSpacing(page);
    recordFacet({ kind: "spacing", observation: { ...broken, checkId: "a11y.spacing.fixture.negative", routeId: "fixture", path: "fixture", locale: "en", state: "fixture", viewport: VIEWPORTS.narrow, result: "FINDING" } });
    for (const code of ["spacing.text-clipped", "spacing.control-obscured", "spacing.scroll-unreachable"]) expect(broken.problems.some((p) => p.code === code && p.target.startsWith("[data-spacing-node="))).toBe(true);
    for (const id of ["fixture-label", "fixture-error"]) {
      const ordinal = await page.locator(`#${id}`).getAttribute("data-spacing-node");
      expect(broken.problems).toContainEqual({ code: "spacing.text-clipped", target: `[data-spacing-node="${ordinal}"]` });
    }
    const covered = await page.locator("#fixture-control").getAttribute("data-spacing-node");
    expect(broken.problems).toContainEqual({ code: "spacing.control-obscured", target: `[data-spacing-node="${covered}"]` });
    await page.setContent(html(false)); await installTextSpacing(page);
    const clean = await probeTextSpacing(page);
    recordFacet({ kind: "spacing", observation: { ...clean, checkId: "a11y.spacing.fixture", routeId: "fixture", path: "fixture", locale: "en", state: "fixture", viewport: VIEWPORTS.narrow, result: clean.problems.length ? "FINDING" : "OBSERVED" } });
    expect(clean.scrollRegionsChecked).toBe(1); expect(clean.problems).toEqual([]);
    await page.locator("style[data-kix-spacing]").evaluate((el) => el.remove());
    const missing = await probeTextSpacing(page);
    expect(missing.problems.some((p) => p.code === "spacing.override-missing")).toBe(true);
    await suite.pass(page, "a11y.spacing.fixture"); await page.close();
  });
});
