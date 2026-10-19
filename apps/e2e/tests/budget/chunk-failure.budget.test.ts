import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { nav, poll, press } from "../../src/desk";
import { recordLine } from "../../src/budget-record";
import { useBrowser } from "../../src/suite";
import { openHome } from "./helpers";

const GIFT_CHUNK = /\/assets\/Gift-[A-Za-z0-9_-]+\.js$/;

describe("screen chunk load failure (stub, headless Chrome)", () => {
  const suite = useBrowser();

  const focusedId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? "");

  async function openGiftFromNav(page: Page): Promise<void> {
    await nav(page, "Gift");
  }

  async function expectLoadPanel(page: Page): Promise<void> {
    const panel = page.locator("[data-cause=screen-load-error]");
    await panel.waitFor();
    await poll(() => focusedId(page), (id) => id === "shell-error-title", "focus on the panel heading");
    const text = (await panel.innerText()).replace(/\s+/g, " ");
    expect(text).toContain("This screen could not be loaded");
    expect(text).toContain("SCREEN_LOAD_FAILED");
    expect(text).toContain("not an UNKNOWN outcome");
    expect(text).toContain("no desk request was sent");
    expect(text).not.toContain("Render error");
    expect(text).not.toMatch(/Gift-[A-Za-z0-9_-]{6,}|\.js|\/assets\//);
    // The nav still works: the shell is intact.
    await page.getByRole("navigation", { name: "Surfaces", exact: true }).getByRole("link", { name: "Receipts", exact: true }).waitFor();
  }

  it("a screen that is slow to load shows a role=status note, then the screen, and focus lands on its heading", async () => {
    const page = await suite.newPage();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(GIFT_CHUNK, async (route) => {
      await gate;
      await route.continue();
    });
    await openHome(page, suite.origin);
    await openGiftFromNav(page);
    const status = page.locator("[data-screen-loading]");
    await status.waitFor();
    expect(await status.getAttribute("role")).toBe("status");
    expect(await status.innerText()).toContain("Loading Gift");
    expect(await page.locator("#desk-main h2").count(), "no screen heading while the code loads").toBe(0);
    release();
    await page.getByRole("heading", { name: "Gift transfer", level: 2 }).waitFor();
    await poll(() => page.evaluate(() => document.activeElement?.tagName + ":" + document.activeElement?.textContent), (value) => /^H2:Gift transfer/.test(value), "focus on the screen heading");
    expect(await page.locator("[data-screen-loading]").count()).toBe(0);
    await suite.pass(page, "budget.chunk-failure.status-while-loading");
    await page.close();
  });

  const variants: [string, string, (route: Parameters<Parameters<Page["route"]>[1]>[0]) => Promise<void>][] = [
    ["budget.chunk-failure.missing-file", "file missing (404)", (route) => route.fulfill({ status: 404, body: "" })],
    [
      "budget.chunk-failure.wrong-content",
      "stale hash answered with the app shell page (200 text/html)",
      (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>x</title>" }),
    ],
  ];

  for (const [checkId, label, answer] of variants) {
    it(`${label}: the route boundary shows its own cause with an again button, by keyboard, and a reload recovers`, async () => {
      const page = await suite.newPage();
      let blocked = true;
      await page.route(GIFT_CHUNK, (route) => (blocked ? answer(route) : route.continue()));
      await openHome(page, suite.origin);
      await openGiftFromNav(page);
      await expectLoadPanel(page);
      // Keyboard: Tab from the heading reaches the again button; Enter makes one new attempt.
      await page.keyboard.press("Tab");
      expect(await focusedId(page)).toBe("shell-error-again");
      blocked = false;
      await page.keyboard.press("Enter");
      const recovered = await Promise.race([
        page.getByRole("heading", { name: "Gift transfer", level: 2 }).waitFor({ timeout: 3000 }).then(() => true, () => false),
        page.locator("[data-cause=screen-load-error]").waitFor({ timeout: 3000 }).then(() => false, () => false),
      ]);
      // Observation only: a browser may remember a failed module file until the page is reloaded.
      recordLine("observations.jsonl", { id: checkId, note: recovered ? "again re-imported the screen in this Chrome" : "again did not re-import the screen in this Chrome; the panel stayed and advised a reload" });
      if (!recovered) {
        await expectLoadPanel(page);
        // Another screen still works from the same page, so the failure is local to one route.
        await nav(page, "Receipts");
        await page.getByRole("heading", { name: /Receipt/ }).first().waitFor();
        expect(await page.locator("[data-cause=screen-load-error]").count()).toBe(0);
        await page.reload();
        await openHome(page, suite.origin);
        await openGiftFromNav(page);
        await page.getByRole("heading", { name: "Gift transfer", level: 2 }).waitFor();
      }
      await suite.pass(page, checkId);
      await page.close();
    });
  }

  it("a failed screen load does not clear or mask an UNKNOWN fence held on another screen", async () => {
    const page = await suite.newPage();
    await page.route(GIFT_CHUNK, (route) => route.fulfill({ status: 404, body: "" }));
    await openHome(page, suite.origin);
    await nav(page, "Session recovery");
    await page.getByRole("heading", { name: "Session recovery (synthetic)" }).waitFor();
    await page.getByLabel("Scenario").selectOption("attach-lost");
    await press(page, "Start new source with this scenario");
    const attach = page.locator("#session-attach-obs-0001");
    await poll(() => attach.isEnabled(), (enabled) => enabled, "attach enabled");
    await attach.click();
    const status = () => page.getByTestId("session-status").innerText();
    const before = await poll(status, (text) => /unknown|unconfirmed|lost/i.test(text), "an unknown status");
    expect(before).toMatch(/Sent 1 in this load/);
    await openGiftFromNav(page);
    await expectLoadPanel(page);
    await nav(page, "Session recovery");
    await page.getByRole("heading", { name: "Session recovery (synthetic)" }).waitFor();
    const after = await status();
    expect(after).toMatch(/Sent 1 in this load/);
    expect(after).toMatch(/unknown|unconfirmed|lost/i);
    expect(after).not.toMatch(/confirmed\./i);
    await suite.pass(page, "budget.chunk-failure.unknown-kept");
    await page.close();
  });
});
