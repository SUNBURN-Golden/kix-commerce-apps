import { describe, expect, it } from "vitest";
import { runAxe } from "../../src/a11y-axe";
import { activeId, tabTo } from "../../src/a11y-keyboard";
import { A11Y_BASELINE } from "../../src/a11y-matrix";
import { useBrowser } from "../../src/suite";
import { openScreen } from "./helpers";

const GUIDE = '[data-first-run="shown"]';
const MARK = '[data-demo="synthetic"]';

describe("first-run onboarding (synthetic stub only)", () => {
  const suite = useBrowser();

  it("keeps first-paint focus, supports keyboard Skip/show-again and tab-scoped persistence, including blocked storage", async () => {
    const page = await suite.newPage();
    await openScreen(page, suite.origin, "/");
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
    expect(await page.getByRole("region", { name: "First visit: this desk runs on synthetic stub data" }).count()).toBe(1);
    expect(await page.getByRole("dialog").count()).toBe(0);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("href"))).toBe("#desk-main");
    for (const role of ["buyer", "organizer", "operator"]) {
      expect(await tabTo(page, `${GUIDE} a[data-role="${role}"]`), role).toBe(true);
    }
    expect(await tabTo(page, "#first-run-skip")).toBe(true);
    await page.keyboard.press("Enter");
    await page.locator(GUIDE).waitFor({ state: "detached" });
    expect(await activeId(page)).toBe("first-run-show");
    expect(await page.evaluate(() => sessionStorage.getItem("kix-onboarding"))).toBe("dismissed");
    expect(await page.evaluate(() => localStorage.getItem("kix-onboarding"))).toBeNull();
    await suite.quiet(page, "Skip guide");
    await openScreen(page, suite.origin, "/help");
    expect(await page.locator(GUIDE).count()).toBe(0);
    expect(await tabTo(page, "#first-run-show")).toBe(true);
    await page.keyboard.press("Enter");
    await page.locator(GUIDE).waitFor();
    expect(await activeId(page)).toBe("first-run-title");
    expect(await page.evaluate(() => sessionStorage.getItem("kix-onboarding"))).toBeNull();
    await page.locator("#first-run-skip").press("Space");
    await page.reload();
    await page.locator("#first-run-show").waitFor();
    expect(await page.locator(GUIDE).count()).toBe(0);
    const fresh = await suite.newPage();
    await openScreen(fresh, suite.origin, "/");
    expect(await fresh.locator(GUIDE).count()).toBe(1);
    await suite.quiet(fresh, "new tab guide");
    await fresh.close();

    const blocked = await suite.newPage();
    await blocked.addInitScript(() => {
      Object.defineProperty(window, "sessionStorage", { get() { throw new Error("blocked"); } });
    });
    await openScreen(blocked, suite.origin, "/receipts");
    await blocked.locator("#first-run-skip").press("Enter");
    await blocked.locator("#first-run-show").waitFor();
    expect(await activeId(blocked)).toBe("first-run-show");
    await blocked.locator("#first-run-show").press("Enter");
    await blocked.locator(GUIDE).waitFor();
    expect(await activeId(blocked)).toBe("first-run-title");
    await suite.quiet(blocked, "blocked preference store");
    await blocked.close();
    await suite.pass(page, "a11y.onboarding.first-visit");
    await page.close();
  });

  it("role links navigate by Enter and focus the main heading even for the current screen", async () => {
    const page = await suite.newPage();
    const starts = [
      { role: "buyer", path: "/buyer" },
      { role: "organizer", path: "/organizer/workspace" },
      { role: "operator", path: "/receipts" },
    ];
    for (const start of starts) {
      // Full load with a cleared preference exercises both navigation and same-page selection.
      for (const current of ["/", start.path]) {
        await openScreen(page, suite.origin, current);
        if (await page.locator("#first-run-show").count()) {
          await page.locator("#first-run-show").press("Enter");
        }
        expect(await tabTo(page, `${GUIDE} a[data-role="${start.role}"]`)).toBe(true);
        await page.keyboard.press("Enter");
        await page.waitForURL((url) => url.pathname === start.path);
        await page.locator(GUIDE).waitFor({ state: "detached" });
        await page.waitForFunction(() => document.activeElement?.tagName === "H2" && document.getElementById("desk-main")?.contains(document.activeElement));
        expect(await page.evaluate(() => sessionStorage.getItem("kix-onboarding"))).toBe("dismissed");
        await suite.quiet(page, `role ${start.role} from ${current}`);
      }
    }
    await suite.pass(page, "a11y.onboarding.role-keys");
    await page.close();
  });

  it("keeps the demo mark on app screens, route errors and app errors, with clean home/not-found axe scans", async () => {
    const page = await suite.newPage();
    for (const path of ["/", "/help", "/no-such-screen"]) {
      await openScreen(page, suite.origin, path);
      expect(await page.locator(MARK).isVisible()).toBe(true);
      expect(await page.locator(MARK).innerText()).toContain("Synthetic demo data.");
      if (path !== "/help") {
        expect((await runAxe(page, A11Y_BASELINE.tags)).violations).toEqual([]);
      }
      await suite.quiet(page, `demo mark ${path}`);
    }
    for (const scope of ["route", "app"]) {
      const fault = await suite.newPage();
      await fault.addInitScript((flag) => { window.__kixShellFault = flag; }, scope);
      await fault.goto(`${suite.faultOrigin}${scope === "route" ? "/receipts" : "/"}`);
      await fault.locator(`.shell-error[data-scope="${scope}"]`).waitFor();
      expect(await fault.locator(MARK).isVisible()).toBe(true);
      await suite.quiet(fault, `demo mark ${scope} error`);
      await fault.close();
    }
    await suite.pass(page, "a11y.onboarding.demo-mark");
    await page.close();
  });

  it("shows Korean guidance at 320px without sideways scrolling, and prints the mark while hiding guide controls", async () => {
    const page = await suite.newPage();
    for (const path of ["/?lang=ko", "/no-such-screen"]) {
      await openScreen(page, suite.origin, path, "narrow");
      expect(await page.locator(MARK).innerText()).toContain("합성 데모 데이터");
      expect(await page.locator("#first-run-title").innerText()).toContain("첫 방문 안내");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    await page.emulateMedia({ media: "print" });
    expect(await page.locator(GUIDE).isVisible()).toBe(false);
    expect(await page.locator(MARK).isVisible()).toBe(true);
    await page.emulateMedia({ media: "screen" });
    await page.locator("#first-run-skip").press("Enter");
    await page.locator("#first-run-show").waitFor();
    await page.emulateMedia({ media: "print" });
    expect(await page.locator("#first-run-show").isVisible()).toBe(false);
    expect(await page.locator(MARK).isVisible()).toBe(true);
    await suite.pass(page, "a11y.onboarding.ko");
    await page.close();
  });
});
