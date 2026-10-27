import { describe, expect, it } from "vitest";
import { newDeskPage, press, nav, expectText } from "../src/desk";
import { tabTo } from "../src/a11y-keyboard";
import { useBrowser } from "../src/suite";

describe("diagnostics (stub)", () => {
  const suite = useBrowser();
  it("retains a completion before diagnostics opens and clears outcomes on reload", async () => {
    const page = await newDeskPage(suite.newPage, suite.origin);
    await page.getByRole("link", { name: "Book", exact: true }).first().click();
    await press(page, "Send create_event"); await expectText(page, "jrn:evt_lanterns:1:create_event");
    await nav(page, "Help"); await page.getByRole("link", { name: "Diagnostics", exact: true }).click();
    await page.locator("#diagnostics-copy").waitFor();
    const json = JSON.parse(await page.locator("#diagnostics-export").inputValue());
    expect(json.outcomes).toHaveLength(1);
    expect(json.outcomes[0]).toMatchObject({ context: "journey", action: "create_event", operationId: "jrn:evt_lanterns:1:create_event", ordinal: 1 });
    await suite.quiet(page, "before diagnostics reload"); await page.reload(); await page.locator("#diagnostics-copy").waitFor();
    expect(JSON.parse(await page.locator("#diagnostics-export").inputValue()).outcomes).toEqual([]);
    await suite.quiet(page, "after diagnostics reload"); await page.close();
  });
  it("opens through Help, copies by keyboard offline and sends nothing", async () => {
    const page = await suite.newPage();
    await page.goto(suite.origin + "/help");
    await page.getByRole("link", { name: "Diagnostics", exact: true }).click();
    await page.locator("#diagnostics-copy").waitFor();
    await suite.session().context.setOffline(true);
    await page.locator('[data-connectivity-state="offline"]').waitFor();
    expect(await tabTo(page, "#diagnostics-copy")).toBe(true);
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("diagnostics-export");
    await expect.poll(() => page.locator('[data-page="diagnostics"] [role="status"]').innerText()).toMatch(/Text selected|Diagnostics copied/);
    const json = JSON.parse(await page.locator("#diagnostics-export").inputValue());
    expect(json.connectivity.state).toBe("offline"); expect(json.sent).toBe(false);
    await suite.pass(page, "diagnostics.copy-keyboard"); await suite.quiet(page, "diagnostics view and export"); await suite.pass(page, "diagnostics.no-network");
    await suite.session().context.setOffline(false); await page.close();
  });
});
