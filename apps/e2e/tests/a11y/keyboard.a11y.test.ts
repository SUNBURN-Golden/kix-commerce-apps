import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { SCREENS, ratchet } from "../../src/a11y-matrix";
import { activeId, disabledReasonProblems, tabTo } from "../../src/a11y-keyboard";
import { recordFacet } from "../../src/a11y-record";
import { recordCheck } from "../../src/run-record";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

const ROLE_NAMES = (page: Page, tablist: string) => page.locator(`[role=tablist][aria-label="${tablist}"] [role=tab]`);

describe("widget keyboard behaviour, disabled reasons, Escape and route change (stub, headless Chrome)", () => {
  const suite = useBrowser();

  async function tablist(path: string, label: string, checkId: string) {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, path);
    const tabs = ROLE_NAMES(page, label);
    const total = await tabs.count();
    expect(total).toBeGreaterThan(1);
    expect(await tabTo(page, `[role=tablist][aria-label="${label}"] [role=tab][aria-selected=true]`), "a Tab stop on the selected tab").toBe(true);
    // Only the selected tab is a Tab stop; the others are reached with arrow keys.
    expect(await page.locator(`[role=tablist][aria-label="${label}"] [role=tab][tabindex="-1"]`).count()).toBe(total - 1);
    const selected = async () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return { role: el.getAttribute("role"), selected: el.getAttribute("aria-selected"), text: el.textContent };
      });
    await page.keyboard.press("End");
    const last = await selected();
    expect(last.role).toBe("tab");
    expect(last.selected).toBe("true");
    await page.keyboard.press("Home");
    const first = await selected();
    expect(first.selected).toBe("true");
    expect(first.text).not.toBe(last.text);
    await page.keyboard.press("ArrowRight");
    expect((await selected()).text).not.toBe(first.text);
    await page.keyboard.press("ArrowLeft");
    expect((await selected()).text).toBe(first.text);
    await suite.pass(page, checkId);
    await page.close();
  }

  it("handoff tablist: Tab reaches the selected tab, Home, End and arrow keys move selection and focus", async () => {
    await tablist("/handoff", "Handoff role", "a11y.kbd.tablist.handoff");
  });

  it("receipts tablist: Tab reaches the selected tab, Home, End and arrow keys move selection and focus", async () => {
    await tablist("/receipts", "Receipt role", "a11y.kbd.tablist.receipts");
  });

  async function listbox(path: string, label: string, checkId: string) {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, path);
    const selector = `[role=listbox][aria-label="${label}"]`;
    if (path === "/inventory") {
      expect(await tabTo(page, "a[href^='/inventory?section=']"), "a section link on the summary").toBe(true);
      await page.keyboard.press("Enter");
      await page.locator(selector).waitFor();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    }
    expect(await tabTo(page, selector), "a Tab stop on the listbox").toBe(true);
    const active = () => page.locator(selector).getAttribute("aria-activedescendant");
    await page.keyboard.press("ArrowDown");
    const one = await active();
    expect(one, "aria-activedescendant after ArrowDown").not.toBeNull();
    expect(await page.locator(`#${one}`).getAttribute("role")).toBe("option");
    await page.keyboard.press("ArrowDown");
    const two = await active();
    expect(two).not.toBe(one);
    await page.keyboard.press("ArrowUp");
    expect(await active()).toBe(one);
    await suite.pass(page, checkId);
    await page.close();
  }

  it("discovery listbox: ArrowDown and ArrowUp move aria-activedescendant", async () => {
    await listbox("/discovery", "Discovery results", "a11y.kbd.listbox.discovery");
  });

  it("inventory listbox: ArrowDown and ArrowUp move aria-activedescendant", async () => {
    await listbox("/inventory", "Seats on this page", "a11y.kbd.listbox.inventory");
  });

  it("journeys details: Enter opens and Space closes the legs disclosure", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/journeys");
    await page.getByRole("table", { name: "Cross-surface journeys" }).waitFor();
    expect(await tabTo(page, "details > summary")).toBe(true);
    const open = () => page.evaluate(() => (document.activeElement?.parentElement as HTMLDetailsElement).open);
    expect(await open()).toBe(false);
    await page.keyboard.press("Enter");
    expect(await open()).toBe(true);
    await page.keyboard.press("Space");
    expect(await open()).toBe(false);
    await suite.pass(page, "a11y.kbd.details.journeys");
    await page.close();
  });

  it("Escape is a no-op: no dialog exists, and Escape neither clears a typed value nor leaves the page", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/booking/evt_lanterns");
    expect(await tabTo(page, "#booking-quantity")).toBe(true);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("3");
    await page.keyboard.press("Escape");
    expect(await page.locator("#booking-quantity").inputValue()).toBe("3");
    expect(await activeId(page)).toBe("booking-quantity");
    expect(new URL(page.url()).pathname).toBe("/booking/evt_lanterns");
    await suite.pass(page, "a11y.kbd.escape-noop");
    await page.close();
  });

  it("route change by keyboard: records the title and where focus lands (observation, not an assertion on the outcome)", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/");
    const before = await page.title();
    expect(await tabTo(page, "nav a[href='/buyer']")).toBe(true);
    await page.keyboard.press("Enter");
    await page.waitForURL("**/buyer");
    await page.locator("#desk-main > *").first().waitFor();
    const after = await page.title();
    const landed = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return "body";
      if (el.id === "desk-main") return "main";
      return el.tagName === "A" ? "link" : "other";
    });
    recordFacet({ kind: "observation", id: "route-change.title", note: before === after ? "document title is the same after the route change" : "document title changed" });
    recordFacet({ kind: "observation", id: "route-change.focus", note: `focus after the route change: ${landed}` });
    await suite.pass(page, "a11y.kbd.route-change");
    await page.close();
  });

  it("disabled controls on /journeys, /booking and /gift print a reason that aria-describedby reaches", async () => {
    const page = await suite.newPage();
    for (const [screenId, path] of [["journeys", "/journeys"], ["booking", "/booking/evt_lanterns"], ["gift", "/gift"]] as const) {
      await openScreen(page, suite.origin, path);
      const problems = await disabledReasonProblems(page);
      const { unlisted, vanished } = ratchet(screenId, "desktop", problems, (id) => id.startsWith("status."));
      expect(unlisted, `disabled-control problems not in KNOWN_FINDINGS on ${screenId}`).toEqual([]);
      expect(vanished, `OPEN findings that no longer show on ${screenId}`).toEqual([]);
    }
    await suite.pass(page, "a11y.status.disabled-reasons");
    await page.close();
  });

  it("no dialog exists on any screen, so trap, Escape close and focus return are NOT_APPLICABLE", async () => {
    const page = await suite.newPage();
    for (const screen of SCREENS) {
      await openScreen(page, suite.origin, screen.path);
      const found = await page.locator("dialog, [role=dialog], [role=alertdialog], [aria-modal=true]").count();
      expect(found, `a dialog now exists on ${screen.path}: add trap, Escape and focus-return probes and drop NOT_APPLICABLE`).toBe(0);
    }
    recordCheck("a11y.dialog.not-applicable");
    await suite.pass(page, "a11y.dialog.not-applicable");
    await page.close();
  });
});
