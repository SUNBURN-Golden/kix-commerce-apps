import { describe, expect, it } from "vitest";
import { SCREENS } from "../src/a11y-matrix";
import { poll } from "../src/desk";
import { useBrowser } from "../src/suite";

describe("offline connectivity (local stub only)", () => {
  const suite = useBrowser();

  it("shows the polite banner and blocks every marked write across every screen and 404, with no service worker attempts", async () => {
    const context = suite.session().context;
    await context.addInitScript(() => {
      const counts = { registrations: 0 };
      Object.defineProperty(window, "__kixConnectivitySW", { value: counts });
      if ("serviceWorker" in navigator) {
        const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
        navigator.serviceWorker.register = (...args) => { counts.registrations += 1; return register(...args); };
      }
    });
    const page = await suite.newPage();
    let controls = 0;
    for (const path of [...SCREENS.map((screen) => screen.path), "/offline-not-found"]) {
      await page.goto(suite.origin + path);
      await page.locator("#desk-main h2").first().waitFor();
      await context.setOffline(true);
      await page.locator('[data-connectivity-state="offline"]').waitFor();
      expect(await page.locator('[data-connectivity-state]').getAttribute("aria-live"), path).toBe("polite");
      expect(await page.locator('[data-cached-read]').count(), path).toBe(1);
      const buttons = page.locator('[data-connectivity-write="true"]');
      const count = await buttons.count();
      controls += count;
      for (let index = 0; index < count; index += 1) {
        expect(await buttons.nth(index).getAttribute("aria-disabled"), `${path} control ${index}`).toBe("true");
        expect(await buttons.nth(index).textContent()).toMatch(/nothing sent|read again/);
      }
      await context.setOffline(false);
      await page.locator('[data-connectivity-state="local"]').waitFor();
      expect(await page.evaluate(() => (window as unknown as { __kixConnectivitySW: { registrations: number } }).__kixConnectivitySW.registrations)).toBe(0);
      expect(await page.evaluate(async () => "serviceWorker" in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0)).toBe(0);
      await suite.quiet(page, path);
    }
    expect(controls).toBeGreaterThan(50);
    await suite.pass(page, "connectivity.all-screens");
    await suite.pass(page, "connectivity.no-service-worker");
    await page.close();
  });

  it("blocks Enter submission, keeps drafts, and requires explicit fresh reading after reconnect", async () => {
    const page = await suite.newPage();
    await page.goto(suite.origin + "/marketing/m01");
    const input = page.getByLabel("Display name");
    await input.fill("Offline draft");
    await suite.session().context.setOffline(true);
    await page.locator('[data-connectivity-state="offline"]').waitFor();
    await input.press("Enter");
    expect(await input.inputValue()).toBe("Offline draft");
    expect(await page.locator("p.empty").textContent()).toContain("No demo card");
    await suite.session().context.setOffline(false);
    await page.locator('[data-connectivity-state="local"]').waitFor();
    expect(await page.locator('[data-connectivity-write]').first().getAttribute("aria-disabled")).toBe("true");
    // Enter must also respect read freshness in the handler, not just the disabled control.
    await input.press("Enter");
    expect(await page.locator("p.empty").textContent()).toContain("No demo card");
    await page.getByRole("button", { name: "Read local session again", exact: true }).click();
    await page.getByRole("button", { name: "Issue demo card", exact: true }).click();
    await page.getByRole("heading", { name: "Offline draft", exact: true }).waitFor();
    await suite.pass(page, "connectivity.form-and-refresh");
    await page.close();
  });

  it("interrupts a held /session response into durable UNKNOWN; reconnect, late delivery, navigation and reload never resend", async () => {
    const page = await suite.newPage();
    await page.goto(suite.origin + "/session");
    await page.getByLabel("Scenario", { exact: true }).selectOption("held-response");
    await page.getByRole("button", { name: "Start new source with this scenario", exact: true }).click();
    const attach = page.locator("#session-attach-obs-0001");
    await poll(() => attach.getAttribute("aria-disabled"), (value) => value !== "true", "attach available");
    await attach.click();
    await poll(() => page.getByTestId("session-status").textContent(), (value) => /Sent 1/.test(value ?? ""), "one dispatch");
    await suite.session().context.setOffline(true);
    await poll(() => page.getByTestId("session-status").textContent(), (value) => /unknown/i.test(value ?? "") && !/in flight/i.test(value ?? ""), "UNKNOWN after interruption");
    await suite.session().context.setOffline(false);
    await page.locator('[data-connectivity-state="local"]').waitFor();
    await page.getByRole("button", { name: "Deliver held response", exact: true }).click();
    await page.getByRole("button", { name: "Read again", exact: true }).click();
    expect(await attach.getAttribute("aria-disabled")).toBe("true");
    // Bypass the button's browser checks to exercise its own handler fence on an explicit second click.
    await attach.evaluate((button: HTMLButtonElement) => button.click());
    expect(await page.getByTestId("session-status").textContent()).toMatch(/Sent 1 in this load/);
    const journal = await page.evaluate(() => JSON.parse(sessionStorage.getItem("kix-session-journal") ?? "{}") as { records?: { outcome: string }[] });
    expect(journal.records?.[0]?.outcome).toBe("UNKNOWN");
    await page.getByRole("navigation", { name: "Surfaces", exact: true }).getByRole("link", { name: "Buyer", exact: true }).click();
    await page.getByRole("navigation", { name: "Surfaces", exact: true }).getByRole("link", { name: "Session recovery", exact: true }).click();
    expect(await page.getByTestId("session-status").textContent()).toMatch(/Sent 1 in this load/);
    await page.reload();
    await poll(() => page.getByTestId("session-status").textContent(), (value) => /came back as UNKNOWN/.test(value ?? ""), "recovered UNKNOWN");
    expect(await page.getByTestId("session-status").textContent()).toMatch(/Sent 0 in this load/);
    await suite.pass(page, "connectivity.no-replay");
    await page.close();
  });
});
