import { SCREENS } from "../../src/a11y-matrix";
import { messages } from "../../../web/src/i18n/generated-catalogue";
import { describe, expect, it } from "vitest";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

const SWITCH = ".locale-switch";

describe("display language: switch by keyboard, persistence in the tab, 320px reflow in Korean (stub, headless Chrome)", () => {
  const suite = useBrowser();

  it("Enter and Space on the switch change the language, html lang follows, and focus stays on the pressed button", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/");
    expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
    expect(await page.locator(`${SWITCH} .locale-status`).innerText()).toBe("");
    await page.locator(`${SWITCH} button[data-locale="ko"]`).focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.documentElement.lang === "ko");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-locale"))).toBe("ko");
    expect(await page.locator(`${SWITCH} button[data-locale="ko"]`).getAttribute("aria-pressed")).toBe("true");
    expect(await page.locator(`${SWITCH} .locale-status`).innerText()).toContain("한국어");
    expect(await page.locator("a.skip").innerText()).toBe("본문으로 건너뛰기");
    expect(await page.title()).toBe("KIX Box Office");
    await page.locator(`${SWITCH} button[data-locale="en"]`).focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.documentElement.lang === "en");
    expect(await page.locator("a.skip").innerText()).toBe("Skip to content");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("data-locale"))).toBe("en");
    await suite.pass(page, "a11y.locale.switch-keys");
    await page.close();
  });

  it("the choice survives a reload in the tab, comes from ?lang=, and a new tab starts in English again", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/buyer?lang=ko");
    expect(await page.evaluate(() => document.documentElement.lang)).toBe("ko");
    expect(await page.evaluate(() => sessionStorage.getItem("kix-locale"))).toBe("ko");
    expect(await page.evaluate(() => localStorage.getItem("kix-locale"))).toBeNull();
    await openScreen(page, suite.origin, "/receipts");
    expect(await page.evaluate(() => document.documentElement.lang)).toBe("ko");
    expect(await page.locator('nav[aria-label="화면 목록"]').count()).toBe(1);
    // The expiry/clock authority is the adapter's; the page carries the stub binding word verbatim in Korean.
    expect(await page.locator(".crumb-binding strong").innerText()).toBe("stub-only");
    const other = await suite.newPage();
    await openScreen(other, suite.origin, "/receipts");
    expect(await other.evaluate(() => document.documentElement.lang)).toBe("en");
    await other.close();
    await suite.pass(page, "a11y.locale.persist");
    await page.close();
  });

  it("at 320px in Korean the page does not scroll sideways: home, menu open, not-found", async () => {
    const page = await suite.newPage();
    for (const path of ["/?lang=ko", "/no-such-screen"]) {
      await openScreen(page, suite.origin, path, "narrow");
      expect(await page.evaluate(() => document.documentElement.lang)).toBe("ko");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), path).toBe(true);
    }
    await page.locator(".nav-toggle").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await suite.pass(page, "a11y.locale.reflow-320");
    await page.close();
  });
});

// User/fixture data and machine fields retain their spelling. These are exact values, never an English-prose wildcard.
const VERBATIM_DATA = new Map([
  ["North Station Lanterns", "Synthetic performance name copied from the adapter"],
  ["listing", "Inventory kind enum"],
  ["open", "Source state enum"],
  ["closed", "Source state enum"],
  ["(none)", "Copied empty reference sentinel"],
]);


describe("full route body catalogue (stub, Korean, headless Chrome)", () => {
  const suite = useBrowser();
  const untranslated = new Set(Object.entries(messages.en).filter(([key, value]) =>
    value !== (messages.ko as Record<string, string>)[key] && /[A-Za-z]/.test(value) && !VERBATIM_DATA.has(value),
  ).map(([, value]) => value.trim()));

  it("renders every registered route with translated copy and accessible names", async () => {
    const page = await suite.newPage();
    for (const screen of SCREENS) {
      await openScreen(page, suite.origin, `${screen.path}?lang=ko`);
      await page.waitForFunction(() => document.documentElement.lang === "ko");
      const visible = await page.locator("#desk-main").evaluate((root) => {
        const values: string[] = [];
        const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walk.nextNode())) {
          const text = node.textContent?.trim();
          // Code and receipt fields are data, as are the verbatim glossary words.
          if (text && !node.parentElement?.closest("code, pre, [data-word]")) values.push(text);
        }
        for (const element of Array.from(root.querySelectorAll("[aria-label], [title], [placeholder]"))) {
          for (const attribute of ["aria-label", "title", "placeholder"]) {
            const text = element.getAttribute(attribute);
            if (text) values.push(text);
          }
        }
        return values;
      });
      expect.soft([...new Set(visible.filter((value) => untranslated.has(value)))], screen.path).toEqual([]);
      expect.soft(visible.filter((value) => Object.hasOwn(messages.en, value)), `${screen.path}: unresolved catalogue keys`).toEqual([]);
      expect(await page.locator("#desk-main").innerText(), screen.path).toMatch(/[가-힣]/);
      await suite.quiet(page, `locale body ${screen.path}`);
    }
    await page.close();
  });

  it("keeps Korean normal, empty, unavailable and pending states usable by keyboard", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/finance?lang=ko");
    await page.locator('[data-finance-state="ready"]').waitFor();
    for (const [scenario, state] of [["empty", "empty"], ["read-lost", "unavailable"]]) {
      await page.locator("#finance-scenario").selectOption(scenario);
      await page.locator("#finance-apply-scenario").focus();
      await page.keyboard.press("Enter");
      await page.locator(`[data-finance-state="${state}"]`).waitFor();
      expect(await page.locator("#finance-status").innerText()).toMatch(/[가-힣]/);
    }
    await openScreen(page, suite.origin, "/platform?lang=ko");
    await page.locator("#platform-scenario").selectOption("held-response");
    await page.locator('[data-platform-state="ready"]').waitFor();
    await page.locator('button[id^="platform-book-"]').first().focus();
    await page.keyboard.press("Enter");
    await page.locator('[data-outcome="IN_FLIGHT"]').waitFor();
    expect(await page.locator("#platform-session").innerText()).toMatch(/[가-힣]/);
    await page.locator("#platform-deliver-held").focus();
    await page.keyboard.press("Space");
    await page.locator('[data-outcome="CONFIRMED"]').waitFor();
    expect(await page.locator("#platform-status").innerText()).toMatch(/[가-힣]/);
    await suite.quiet(page, "Korean state controls and keyboard");
    await page.close();
  });
});
