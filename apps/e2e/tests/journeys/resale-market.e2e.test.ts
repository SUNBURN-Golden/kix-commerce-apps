import type {} from "../../src/resale-fault-types";
import { describe, expect, it } from "vitest";
import { useBrowser } from "../../src/suite";
import { newDeskPage } from "../../src/desk";
describe("synthetic resale marketplace", () => {
  const suite = useBrowser();
  it("searches bilingual fixtures and paginates without requests", async () => {
    const page = await newDeskPage(suite.newPage,suite.origin);
    await page.goto(suite.origin + "/resale/market");
    await page.getByRole("heading",{ name: "Orbit object" }).waitFor();
    await page.getByRole("button",{ name: "Next page" }).click(); await page.getByRole("heading",{ name: "Arc object" }).waitFor();
    await page.getByLabel("Search products").fill("궤도"); await page.getByRole("button",{ name: "Search", exact: true }).click(); await page.getByRole("heading",{ name: "Orbit object" }).waitFor();
    await page.getByLabel("Search products").fill("absent"); await page.getByRole("button",{ name: "Search", exact: true }).click(); await page.getByText("No synthetic products found. Change your search.").waitFor();
    await suite.pass(page,"resale-market.SUCCESS"); await page.close();
  });
  it("reviews and records bids, asks and both instant sides; navigation retains state", async () => {
    const page = await newDeskPage(suite.newPage,suite.origin); await page.goto(suite.origin + "/resale/market/demo-001");
    await page.getByLabel("Action",{ exact: true }).waitFor();
    await suite.session().context.setOffline(true);
    await page.locator('[data-connectivity-state="offline"]').waitFor();
    await suite.session().context.setOffline(false);
    await page.locator('[data-connectivity-state="local"]').waitFor();
    expect(await page.getByRole("button",{ name: /^Review simulation/ }).getAttribute("aria-disabled")).toBe("true");
    await page.getByRole("button",{ name: "Read current fixtures" }).click();
    expect(await page.getByRole("button",{ name: "Review simulation", exact: true }).getAttribute("aria-disabled")).not.toBe("true");
    for (const kind of ["bid","ask","instant-buy","instant-sell"]) {
      await page.getByLabel("Action",{ exact: true }).selectOption(kind);
      await page.getByRole("button",{ name: "Review simulation" }).click(); await page.getByRole("heading",{ name: "Review simulation" }).waitFor();
      await page.getByRole("button",{ name: "Record simulation once" }).click(); await page.locator('[data-market-outcome="CONFIRMED"]').waitFor();
      await page.getByLabel("Action",{ exact: true }).waitFor();
    }
    expect(await page.getByText("Simulated trade",{ exact: true }).count()).toBe(3);
    await page.getByRole("link",{ name: "Resale market", exact: true }).last().click();
    await page.getByRole("link").filter({ has: page.getByRole("heading",{ name: "Orbit object" }) }).click();
    await page.getByLabel("Action",{ exact: true }).waitFor();
    expect(await page.getByText("Simulated trade",{ exact: true }).count()).toBe(3);
    await page.getByLabel("Action",{ exact: true }).selectOption("instant-buy"); expect(await page.getByRole("button",{ name: "Review simulation" }).isDisabled()).toBe(true);
    await suite.pass(page,"resale-product.SUCCESS"); await page.close();
  });
  it.each(["reject","lost","wrong-side","held"] as const)("isolates test-only %s responses and counts one dispatch", async mode => {
    const page = await suite.newPage(); await page.addInitScript((mode) => { window.__kixResaleFault = { mode, dispatches: 0 }; },mode);
    await page.goto(suite.faultOrigin + "/resale/market/demo-001");
    await page.getByRole("button",{ name: "Review simulation" }).click();
    const submit = page.getByRole("button",{ name: "Record simulation once" });
    await submit.focus(); await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
    if (mode === "held") {
      await page.getByRole("link",{ name: "Resale market", exact: true }).last().click();
      await page.evaluate(() => window.__kixResaleFault?.release?.());
      await page.getByRole("link").filter({ has: page.getByRole("heading",{ name: "Orbit object" }) }).click();
    await page.getByLabel("Action",{ exact: true }).waitFor();
    }
    const result = mode === "reject" ? "REJECTED" : "UNKNOWN";
    await page.locator(`[data-market-outcome="${result}"]`).waitFor();
    expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(1);
    if (result === "UNKNOWN") {
      await suite.session().context.setOffline(true);
    await page.locator('[data-connectivity-state="offline"]').waitFor(); await suite.session().context.setOffline(false);
    await page.locator('[data-connectivity-state="local"]').waitFor();
      await page.getByRole("button",{ name: "Read current fixtures" }).click();
      await page.locator('[data-locale="ko"]').click();
      await page.locator('[data-market-outcome="UNKNOWN"]').waitFor();
      expect(await page.getByRole("button",{ name: "모의 거래 검토" }).isDisabled()).toBe(true);
      expect(await page.evaluate(() => window.__kixResaleFault?.dispatches)).toBe(1);
    }
    await suite.pass(page,mode === "reject" ? "resale-product.REJECT" : mode === "lost" ? "resale-product.UNKNOWN" : `resale-product.${mode}`); await page.close();
  });
});
