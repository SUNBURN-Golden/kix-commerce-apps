import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { skipLinkProblems, tabTo } from "../../src/a11y-keyboard";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

declare global {
  interface Window {
    __kixShellFault?: string;
  }
}

const HOSTILE_PIECES = ["sk_live", "Bearer", "buyer.person", "tok_FAKE", "Receipts.tsx", "at renderReceipts", "Error: leak"];

/** Where focus is, as the tag name and text of the focused element inside the document. */
async function focused(page: Page): Promise<{ tag: string; text: string; id: string }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return { tag: el?.tagName ?? "", text: (el?.textContent ?? "").trim().slice(0, 60), id: el?.id ?? "" };
  });
}

/** Moves inside the app without a page load, as a link press does. */
async function jumpTo(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await page.waitForFunction((target) => location.pathname === target, path);
}

async function expectNoLeak(page: Page): Promise<void> {
  const text = await page.locator("#root").innerText();
  for (const piece of HOSTILE_PIECES) {
    expect(text, `the screen must not show ${piece}`).not.toContain(piece);
  }
}

describe("app shell: page title, heading focus, not-found, boot and noscript notes (stub, headless Chrome)", () => {
  const suite = useBrowser();

  it("a keyboard route change sets the page title and moves focus to the page heading", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/");
    expect(await page.title()).toBe("KIX Box Office");
    expect(await tabTo(page, "nav a[href='/buyer']")).toBe(true);
    await page.keyboard.press("Enter");
    await page.waitForURL("**/buyer");
    await page.waitForFunction(() => document.activeElement?.tagName === "H2");
    expect(await page.title()).toBe("Buyer · KIX Box Office");
    expect(await focused(page)).toMatchObject({ tag: "H2", text: "Buyer workspace" });
    // The temporary tabindex goes away once focus leaves, so the heading is not a permanent Tab stop.
    await page.keyboard.press("Tab");
    expect(await page.locator("#desk-main h2[tabindex]").count()).toBe(0);
    await suite.pass(page, "a11y.shell.title-focus");
    await page.close();
  });

  it("the unknown address shows a real screen: title, heading, focus, links, and a clean Tab and skip-link flow", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/no-such-screen");
    expect(new URL(page.url()).pathname, "no redirect").toBe("/no-such-screen");
    expect(await page.title()).toBe("Page not found · KIX Box Office");
    expect(await page.getByRole("heading", { name: "Page not found" }).count()).toBe(1);
    expect(await skipLinkProblems(page)).toEqual([]);
    // In-app jump from a real screen to an unknown one moves focus to the heading.
    await openScreen(page, suite.origin, "/buyer");
    await jumpTo(page, "/also-not-here");
    await page.waitForFunction(() => document.activeElement?.tagName === "H2");
    expect(await focused(page)).toMatchObject({ tag: "H2", text: "Page not found" });
    expect(await page.title()).toBe("Page not found · KIX Box Office");
    await page.keyboard.press("Tab");
    expect(await focused(page)).toMatchObject({ tag: "A", text: "Go to Box office" });
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname === "/");
    await page.waitForFunction(() => document.activeElement?.tagName === "H2");
    expect(await page.title()).toBe("KIX Box Office");
    await suite.pass(page, "a11y.shell.not-found-keys");
    await page.close();
  });

  it("focus is not moved on first paint, by a search edit, or by the discovery row alias", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/discovery");
    expect((await focused(page)).tag, "first paint leaves focus alone").toBe("BODY");
    expect(await tabTo(page, "#discovery-q")).toBe(true);
    await page.keyboard.type("a");
    await page.waitForFunction(() => new URLSearchParams(location.search).get("q") === "a");
    expect((await focused(page)).id).toBe("discovery-q");
    await suite.pass(page, "a11y.shell.no-focus-steal");
    await page.close();
  });

  it("with JavaScript off the page shows the noscript note", async () => {
    const context = await suite.session().browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    try {
      const page = await context.newPage();
      await page.goto(suite.origin + "/");
      expect(await page.locator("noscript").count(), "one in the head for the style, one in the body for the note").toBe(2);
      expect(await page.locator("body").innerText()).toContain("This desk needs JavaScript");
      expect(await page.locator("body").innerText()).not.toContain("Loading the desk");
    } finally {
      await context.close();
    }
    const probe = await suite.newPage();
    await openScreen(probe, suite.origin, "/");
    await suite.pass(probe, "a11y.shell.noscript");
    await probe.close();
  });

  it("while the script is held the loading note shows, and the desk replaces it when the script runs", async () => {
    const page = await suite.newPage();
    const gate = suite.gate();
    await page.route("**/assets/*.js", async (route) => {
      await gate.opened;
      await route.fallback();
    });
    const loading = page.goto(suite.origin + "/", { waitUntil: "commit" });
    await page.locator("#root .boot-note").waitFor();
    expect(await page.locator("#root .boot-note").innerText()).toContain("Loading the desk");
    gate.release();
    await loading;
    await page.locator("#desk-main").waitFor();
    expect(await page.locator("#root .boot-note").count()).toBe(0);
    await suite.pass(page, "a11y.shell.boot-note");
    await page.close();
  });
});

describe("app shell: render faults on the fixture build (the fixture throws on purpose; stub, headless Chrome)", () => {
  const suite = useBrowser();

  async function openFault(path: string, flag: string): Promise<Page> {
    const page = await suite.newPage();
    await page.addInitScript((value) => {
      window.__kixShellFault = value;
    }, flag);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${suite.faultOrigin}${path}`);
    return page;
  }

  it("a screen that throws shows the route panel, keeps UNKNOWN as it was, and sends nothing", async () => {
    expect(suite.faultOrigin, "the fixture build is served").toBeDefined();
    const page = await openFault("/session", "route");
    await page.getByRole("heading", { name: "Session recovery (synthetic)" }).waitFor();
    await page.getByLabel("Scenario").selectOption("attach-lost");
    await page.getByRole("button", { name: "Start new source with this scenario" }).press("Enter");
    const attach = page.locator("#session-attach-obs-0001");
    await attach.waitFor();
    await page.waitForFunction(() => !(document.getElementById("session-attach-obs-0001") as HTMLButtonElement).disabled);
    await attach.press("Enter");
    const status = page.getByTestId("session-status");
    await status.getByText(/unknown|unconfirmed|lost/i).first().waitFor();
    const before = (await status.textContent()) ?? "";
    expect(before).toMatch(/Sent 1/);

    // Reach the failing screen from inside the app, by keyboard.
    expect(await tabTo(page, "nav a[href='/receipts']")).toBe(true);
    await page.keyboard.press("Enter");
    await page.locator("#shell-error-title").waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "shell-error-title");
    expect(await page.getByRole("alert").count()).toBeGreaterThan(0);
    const panel = await page.locator("section.shell-error").innerText();
    expect(panel).toContain("Render error");
    expect(panel).toMatch(/shell-fault-\d{4}/);
    expect(panel).toContain("none (no request was involved)");
    await expectNoLeak(page);

    // The nav is still there. "Show this screen again" with the fault still set keeps the panel.
    await page.locator("#shell-error-again").press("Enter");
    await page.locator("#shell-error-title").waitFor();
    await expectNoLeak(page);
    // Clear the fault, then ask again: the real screen is drawn.
    await page.evaluate(() => {
      window.__kixShellFault = "";
    });
    await page.locator("#shell-error-again").press("Enter");
    await page.getByRole("heading", { name: "Receipt explorer" }).waitFor();

    // Back on /session in the same page load: the same UNKNOWN, still one sent request, nothing cleared.
    expect(await tabTo(page, "nav a[href='/session']")).toBe(true);
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Session recovery (synthetic)" }).waitFor();
    const after = (await page.getByTestId("session-status").textContent()) ?? "";
    expect(after).toMatch(/Sent 1/);
    expect(after).toMatch(/unknown|unconfirmed|lost/i);
    await suite.pass(page, "a11y.shell.route-fault");
    await page.close();
  });

  it("a fault in the shell itself shows the app panel with a plain home link and recovers when asked again", async () => {
    const page = await openFault("/", "app");
    await page.locator("#shell-error-title").waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "shell-error-title");
    expect(await page.locator("section.shell-error").getAttribute("data-scope")).toBe("app");
    expect(await page.locator("section.shell-error a[href='/']").count()).toBe(1);
    await expectNoLeak(page);
    await page.locator("#shell-error-again").press("Enter");
    await page.locator("#shell-error-title").waitFor();
    await page.evaluate(() => {
      window.__kixShellFault = "";
    });
    await page.locator("#shell-error-again").press("Enter");
    await page.locator("#desk-main").waitFor();
    expect(await page.locator("section.shell-error").count()).toBe(0);
    await suite.pass(page, "a11y.shell.app-fault");
    await page.close();
  });
});
