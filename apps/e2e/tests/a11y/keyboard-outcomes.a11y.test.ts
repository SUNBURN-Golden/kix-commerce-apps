import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { keyboardFacetFor } from "../../src/journey-matrix";
import { KEYBOARD_DRIVES } from "../../src/keyboard-outcomes";
import { keyboardOnly, PointerInputError } from "../../src/keyboard-guard";
import { installLiveCounter, liveProblems, settleLive } from "../../src/keyboard-probes";
import { runDrive } from "../../src/keyboard-runner";
import { recordFacet } from "../../src/a11y-record";
import { useBrowser } from "../../src/suite";

/**
 * Keyboard-only drives to every BROWSER SUCCESS, REJECT and UNKNOWN cell of the journey matrix. Each drive uses
 * Tab, Shift+Tab, Enter, Space, arrow keys and text entry only, through a page that refuses pointer input.
 */
describe("keyboard-only outcome journeys (stub, headless Chrome)", () => {
  const suite = useBrowser();

  async function openHelp(page: Page) {
    await page.goto(suite.origin + "/help");
    await page.locator("#desk-main > :not([data-screen-loading])").first().waitFor();
  }

  it("pointer guard: click, mouse, tap, focus shortcuts and other keys fail the helper, caught or not", async () => {
    // Node side, on chained locators, handles and devices. Each refusal is recorded even though it is caught here.
    const refused = await keyboardOnly(await suite.newPage());
    await openHelp(refused.page);
    const handle = await refused.page.$("a");
    expect(handle).not.toBeNull();
    const attempts: (() => unknown)[] = [
      () => refused.page.locator("a").first().click(),
      () => refused.page.getByRole("link").filter({ hasText: /./ }).nth(0).tap(),
      () => refused.page.locator("main").locator("a").last().dblclick(),
      () => refused.page.frameLocator("iframe").locator("a").first().click(),
      () => refused.page.locator("a").first().focus(),
      () => refused.page.locator("input").first().fill("x"),
      () => handle?.click(),
      () => refused.page.mouse.move(4, 4),
      () => refused.page.mouse.click(4, 4),
      () => refused.page.touchscreen.tap(4, 4),
      () => refused.page.click("a"),
      () => refused.page.keyboard.press("Escape"),
      () => refused.page.keyboard.down("Shift"),
    ];
    for (const attempt of attempts) {
      expect(attempt).toThrow(PointerInputError);
    }
    expect(refused.ledger.violations).toHaveLength(attempts.length);
    await expect(refused.assertNoPointer()).rejects.toThrow(PointerInputError);
    await suite.quiet(refused.page, "pointer guard: refused calls");
    await refused.page.close();

    // Page side: a raw mouse move or click is seen by the page, and survives a reload of the guarded page.
    const rawPage = await suite.newPage();
    const watched = await keyboardOnly(rawPage);
    await openHelp(watched.page);
    await rawPage.mouse.move(6, 6);
    await rawPage.mouse.click(6, 6);
    // A reload starts a new document, so the application network count is checked first.
    await suite.quiet(rawPage, "pointer guard: before reload");
    await watched.page.reload();
    await watched.page.locator("#desk-main > :not([data-screen-loading])").first().waitFor();
    await expect(watched.assertNoPointer()).rejects.toThrow(/page event (mousemove|pointermove)/);
    expect(watched.ledger.pageEvents).toEqual(expect.arrayContaining(["mousedown", "click"]));
    await suite.quiet(rawPage, "pointer guard: after reload");
    await watched.page.close();

    // A keyboard-only walk leaves the ledger empty.
    const cleanPage = await suite.newPage();
    const clean = await keyboardOnly(cleanPage);
    await openHelp(clean.page);
    await clean.page.keyboard.press("Tab");
    await clean.page.keyboard.press("Enter");
    await clean.page.keyboard.press("Shift+Tab");
    await clean.page.keyboard.press("Tab");
    await clean.assertNoPointer();
    expect(clean.ledger).toEqual({ violations: [], pageEvents: [] });
    await suite.pass(cleanPage, "a11y.kbd.outcome.pointer-guard");
    await cleanPage.close();
  });

  it("live probe: zero, duplicate and delayed duplicate announcements are counted; nested, busy and off regions are not doubled", async () => {
    expect(liveProblems({ count: 1, settled: false, log: [] })).toEqual(["live.not-settled"]);
    const page = await suite.newPage();
    await openHelp(page);
    type Change = { id: string; text?: string; html?: string; attr?: [string, string]; after?: number };
    /** Builds a probe fixture outside the desk, starts the counter, applies the changes and returns the count. */
    const count = async (html: string, changes: Change[]) => {
      await page.evaluate((markup) => {
        document.getElementById("kbd-probe-fixture")?.remove();
        const box = document.createElement("div");
        box.id = "kbd-probe-fixture";
        box.innerHTML = markup;
        document.body.append(box);
      }, html);
      await installLiveCounter(page);
      const startedAt = Date.now();
      await page.evaluate((list: Change[]) => {
        for (const change of list) {
          const apply = () => {
            const el = document.getElementById(change.id);
            if (!el) return;
            if (change.text !== undefined) el.textContent = change.text;
            if (change.html !== undefined) el.innerHTML = change.html;
            if (change.attr) el.setAttribute(change.attr[0], change.attr[1]);
          };
          if (change.after === undefined) apply();
          else setTimeout(apply, change.after);
        }
      }, changes);
      const result = await settleLive(page, startedAt);
      // Use the same verdict as every journey: zero, duplicate and delayed duplicate fixtures must fail it.
      expect(liveProblems(result)).toEqual(result.count === 1 ? [] : [`live.announcements-${result.count}`]);
      return result.count;
    };

    expect(await count('<p id="a" role="status">one</p>', []), "no change").toBe(0);
    expect(await count('<p id="a" role="status">one</p>', [{ id: "a", text: "two" }]), "one change").toBe(1);
    expect(await count('<p id="a" role="status" aria-live="polite">one</p>', [{ id: "a", text: "two" }]), "two live attributes on one element").toBe(1);
    expect(await count('<p id="a" role="status">one</p><p id="b" aria-live="polite">x</p>', [{ id: "a", text: "two" }, { id: "b", text: "y" }]), "sibling duplicate").toBe(2);
    expect(await count('<p id="a" role="status">one</p>', [{ id: "a", text: "two" }, { id: "a", text: "three", after: 400 }]), "delayed duplicate").toBe(2);
    expect(await count('<div aria-live="polite">outer <span id="i" role="status">in</span></div>', [{ id: "i", text: "inner" }]), "nested inner only").toBe(1);
    expect(await count('<div aria-live="polite"><b id="o">outer</b> <span id="i" role="status">in</span></div>', [{ id: "o", text: "OUTER" }, { id: "i", text: "inner" }]), "nested both").toBe(2);
    expect(
      await count('<p id="a" role="status" aria-busy="true">one</p>', [{ id: "a", text: "two" }, { id: "a", text: "three" }, { id: "a", attr: ["aria-busy", "false"], after: 200 }]),
      "busy region",
    ).toBe(1);
    expect(
      await count('<div id="w" aria-busy="true"><p id="a" role="status">one</p></div>', [{ id: "a", text: "two" }, { id: "w", attr: ["aria-busy", "false"], after: 200 }]),
      "busy ancestor",
    ).toBe(1);
    expect(await count('<div id="h"></div>', [{ id: "h", html: '<p role="status">inserted</p>' }]), "polite region inserted with text").toBe(1);
    expect(await count('<div id="h"></div>', [{ id: "h", html: '<p role="alert">inserted</p>' }]), "alert inserted with text").toBe(1);
    expect(await count('<p id="a" role="status">one</p><div id="h"></div>', [{ id: "a", text: "two" }, { id: "h", html: '<p aria-live="polite">inserted</p>' }]), "change plus inserted duplicate").toBe(2);
    expect(await count('<div id="h"></div>', [{ id: "h", html: '<p role="status"></p>' }]), "empty region inserted").toBe(0);
    // A path change must not hide a region inserted in main or its delayed update.
    const path = await page.evaluate(() => location.pathname);
    await page.evaluate(() => {
      const main = document.getElementById("desk-main");
      const box = document.createElement("div");
      box.id = "kbd-probe-main";
      main?.append(box);
    });
    await installLiveCounter(page);
    const routeStarted = Date.now();
    await page.evaluate(() => {
      history.pushState(history.state, "", "/kbd-probe-route");
      const box = document.getElementById("kbd-probe-main");
      if (box) box.innerHTML = '<p id="r" role="status">new screen</p>';
      setTimeout(() => {
        const line = document.getElementById("r");
        if (line) line.textContent = "changed on the new screen";
      }, 200);
    });
    expect((await settleLive(page, routeStarted)).count, "new-screen region inserted, then changed").toBe(2);
    await page.evaluate((back) => {
      history.replaceState(history.state, "", back);
      document.getElementById("kbd-probe-main")?.remove();
    }, path);
    expect(await count('<p id="a" role="status" aria-live="off">one</p>', [{ id: "a", text: "two" }]), "off overrides implicit status").toBe(0);
    expect(await count('<div aria-live="polite">stay <span id="q" aria-live="off">quiet</span></div>', [{ id: "q", text: "still quiet" }]), "aria-live off line").toBe(0);
    await page.evaluate(() => document.getElementById("kbd-probe-fixture")?.remove());
    await suite.pass(page, "a11y.kbd.outcome.live-probe");
    await page.close();
  });

  for (const drive of KEYBOARD_DRIVES) {
    it(`${drive.checkId}: keys only; focus ${drive.focus}, one announcement, fence, no overflow at 360px`, async () => {
      const guard = await keyboardOnly(await suite.newPage());
      const fence = keyboardFacetFor(drive.checkId);
      const result = await runDrive(guard, suite.origin, drive, fence);
      expect(result.problems, `live regions: ${result.liveLog.join(" | ")}`).toEqual([]);
      await guard.assertNoPointer();
      recordFacet({
        kind: "observation",
        id: drive.checkId,
        note: `focus ${drive.focus}; announcements ${result.announcements}; fence ${fence}; typed fields ${result.typedFields}; pointer events 0`,
      });
      await suite.pass(guard.page, drive.checkId);
      await guard.page.close();
    });
  }
});
