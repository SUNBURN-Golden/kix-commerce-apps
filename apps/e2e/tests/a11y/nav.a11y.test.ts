import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import { ROUTES, navGroups } from "../../../web/src/shell/route-registry";
import { runAxe } from "../../src/a11y-axe";
import { A11Y_BASELINE, ratchet } from "../../src/a11y-matrix";
import { tabWalkProblems } from "../../src/a11y-keyboard";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

const NAV = 'nav[aria-label="Surfaces"]';
const EXPECTED_LINKS = navGroups().flatMap((group) => group.links.map((link) => link.path));

interface Focus {
  tag: string;
  text: string;
  href: string;
  inNav: boolean;
  expanded: string | null;
}

async function focus(page: Page): Promise<Focus> {
  return page.evaluate((nav) => {
    const el = document.activeElement as HTMLElement | null;
    return {
      tag: el?.tagName ?? "",
      text: (el?.textContent ?? "").trim().slice(0, 60),
      href: el?.getAttribute("href") ?? "",
      inNav: Boolean(el?.closest(nav)),
      expanded: el?.getAttribute("aria-expanded") ?? null,
    };
  }, NAV);
}

/** Tabs from the top of the page and returns the hrefs of the links reached inside the Surfaces nav, in order, until focus leaves it. */
async function tabThroughNav(page: Page, expectToggle: boolean): Promise<string[]> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const hrefs: string[] = [];
  let entered = false;
  for (let i = 0; i < 120; i += 1) {
    await page.keyboard.press("Tab");
    const at = await focus(page);
    if (at.inNav) {
      entered = true;
      if (at.tag === "A") {
        hrefs.push(at.href);
      } else {
        expect(at.tag, "the only non-link stop in the nav is the Menu button").toBe("BUTTON");
        expect(expectToggle).toBe(true);
      }
    } else if (entered) {
      break;
    }
  }
  return hrefs;
}

async function navLinksVisible(page: Page): Promise<number> {
  return page.locator(`${NAV} a`).evaluateAll((links) => links.filter((link) => (link as HTMLElement).offsetParent !== null).length);
}

describe("grouped navigation by keyboard: wide, 320px menu, Escape, focus return, current page, breadcrumb (stub, headless Chrome)", () => {
  const suite = useBrowser();

  it("at 1280px the Menu button is hidden and Tab reaches every group and link in registry order", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/buyer");
    expect(await page.locator(".nav-toggle").isVisible()).toBe(false);
    expect(await navLinksVisible(page)).toBe(EXPECTED_LINKS.length);
    expect(await page.locator(`${NAV} .nav-group-label`).allTextContents()).toEqual(navGroups().map((group) => group.label));
    expect(await tabThroughNav(page, false)).toEqual(EXPECTED_LINKS);
    // Exactly one link is current, by aria-current and not by colour alone: bold and a thicker rule.
    const current = page.locator(`${NAV} a[aria-current="page"]`);
    expect(await current.count()).toBe(1);
    expect(await current.getAttribute("href")).toBe("/buyer");
    expect(await current.evaluate((el) => getComputedStyle(el).fontWeight)).toBe("700");
    expect(await current.evaluate((el) => parseFloat(getComputedStyle(el).borderBottomWidth))).toBeGreaterThanOrEqual(4);
    await suite.pass(page, "a11y.nav.desktop-keys");
    await page.close();
  });

  it("at 320px the links fold away, Enter and Space open the menu, Tab reaches every link, Escape closes and returns to the button", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/", "narrow");
    const toggle = page.locator(".nav-toggle");
    expect(await toggle.isVisible()).toBe(true);
    expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    expect(await navLinksVisible(page), "closed: no link is shown, so none is a Tab stop").toBe(0);
    expect(await tabThroughNav(page, true)).toEqual([]);

    await page.keyboard.press("Tab");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await toggle.focus();
    await page.keyboard.press("Enter");
    expect(await toggle.getAttribute("aria-expanded")).toBe("true");
    expect(await navLinksVisible(page)).toBe(EXPECTED_LINKS.length);
    expect(await tabThroughNav(page, true)).toEqual(EXPECTED_LINKS);

    // Escape from inside the open menu closes it and puts focus on the button.
    await page.locator(`${NAV} a[href="/gift"]`).focus();
    await page.keyboard.press("Escape");
    expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    expect(await focus(page)).toMatchObject({ tag: "BUTTON", text: "Menu", expanded: "false" });
    expect(await navLinksVisible(page)).toBe(0);

    // Escape with the menu closed does nothing, and Space opens it again.
    await page.keyboard.press("Escape");
    expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    await page.keyboard.press("Space");
    expect(await toggle.getAttribute("aria-expanded")).toBe("true");
    await page.keyboard.press("Space");
    expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    await suite.pass(page, "a11y.nav.menu-keys");
    await page.close();
  });

  it("at 320px choosing a link moves to the page heading, and choosing the current page returns to the button", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/", "narrow");
    const toggle = page.locator(".nav-toggle");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await page.locator(`${NAV} a[href="/buyer"]`).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/buyer");
    await page.waitForFunction(() => document.activeElement?.tagName === "H2");
    expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    expect(await navLinksVisible(page)).toBe(0);

    await toggle.focus();
    await page.keyboard.press("Enter");
    const current = page.locator(`${NAV} a[aria-current="page"]`);
    expect(await current.getAttribute("href")).toBe("/buyer");
    await current.focus();
    await page.keyboard.press("Enter");
    expect(await toggle.getAttribute("aria-expanded")).toBe("false");
    expect(await focus(page)).toMatchObject({ tag: "BUTTON", text: "Menu" });
    expect(new URL(page.url()).pathname).toBe("/buyer");
    await suite.pass(page, "a11y.nav.menu-focus");
    await page.close();
  });

  it("at 320px the open menu has no axe violation outside the screen's known findings, no keyboard trap, and no sideways scroll", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/", "narrow");
    await page.locator(".nav-toggle").focus();
    await page.keyboard.press("Enter");
    const result = await runAxe(page, A11Y_BASELINE.tags);
    const violations = result.violations.map((rule) => rule.ruleId).sort();
    const { unlisted } = ratchet("box-office", "narrow", violations, (id) => !id.includes("."));
    expect(unlisted, "violations with the menu open").toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const walk = await tabWalkProblems(page);
    expect(walk.problems).toEqual([]);
    await suite.pass(page, "a11y.nav.menu-axe");
    await page.close();
  });

  it("the breadcrumb is a separate landmark: group text, a parent link, the current page, and a booking page links nowhere", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/marketing/m01");
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
    expect(await crumbs.getByRole("link").allInnerTexts()).toEqual(["Marketing"]);
    expect(await crumbs.locator('[aria-current="page"]').innerText()).toBe("Marketing M01");
    expect(await page.getByRole("navigation", { name: "Surfaces", exact: true }).locator('a[aria-current="page"]').getAttribute("href")).toBe("/marketing");
    expect(await page.getByRole("banner").count()).toBe(1);
    expect(await page.getByRole("main").count()).toBe(1);
    await crumbs.getByRole("link", { name: "Marketing" }).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname === "/marketing");
    await page.waitForFunction(() => document.activeElement?.tagName === "H2");
    await openScreen(page, suite.origin, ROUTES.find((route) => route.id === "booking")!.sample);
    expect(await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).getByRole("link").count()).toBe(0);
    expect(await page.locator(`${NAV} a[aria-current="page"]`).count()).toBe(0);
    await openScreen(page, suite.origin, "/no-such-screen");
    expect(await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).count()).toBe(0);
    await suite.pass(page, "a11y.nav.breadcrumb");
    await page.close();
  });
});
