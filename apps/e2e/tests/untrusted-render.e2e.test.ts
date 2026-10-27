import { describe, expect, it } from "vitest";
import { useBrowser } from "../src/suite";

const suite = useBrowser();
const hostile = `<img src=x onerror="globalThis.__kixOwned=1">${"L".repeat(140)}end🎟️`;

describe("untrusted render and CSP", () => {
  it("renders a hostile route value as text with no policy violation or external request", async () => {
    const page = await suite.newPage();
    await page.addInitScript(() => {
      const target = window as unknown as { __kixCspViolations: string[]; __kixOwned?: number };
      target.__kixCspViolations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        target.__kixCspViolations.push(`${event.effectiveDirective}:${event.blockedURI}`);
      });
    });
    await page.goto(suite.origin + "/");
    await page.evaluate((value) => {
      history.pushState(null, "", `/booking/${encodeURIComponent(value)}`);
      dispatchEvent(new PopStateEvent("popstate"));
    }, hostile);
    await page.getByText("Requested performance:").waitFor();
    expect(await page.locator("img").count()).toBe(0);
    expect(await page.locator(".safe-text-original pre").textContent()).toBe(hostile);
    expect(await page.locator(".safe-text-original").textContent()).toContain("Copyable original");
    const state = await page.evaluate(() => {
      const target = window as unknown as { __kixCspViolations: string[]; __kixOwned?: number };
      return { violations: target.__kixCspViolations, owned: target.__kixOwned };
    });
    expect(state).toEqual({ violations: [], owned: undefined });
    expect(suite.session().ledger.nonLoopback).toEqual([]);
    await suite.pass(page, "untrusted-render.csp");
    await page.close();
  });
});
