import { describe, expect, it } from "vitest";
import { tabTo } from "../../src/a11y-keyboard";
import { keyboardOnly } from "../../src/keyboard-guard";
import { poll } from "../../src/desk";
import { useBrowser } from "../../src/suite";

declare global {
  interface Window {
    __kixReadFault?: {
      method: "readPage" | "readRow" | "readSummary" | "readSelection";
      mode: "throw" | "reject" | "held" | "normal";
      calls: number;
      release?: () => void;
    };
  }
}

const stages = [
  { id: "list", route: "/discovery", method: "readPage", owner: "#discovery-live", state: "data-live-state", status: "discovery-live-status", mode: "throw" },
  { id: "detail", route: "/discovery/pro-0001", method: "readRow", owner: "#discovery-live-detail", state: "data-live-detail", status: "discovery-live-detail", mode: "reject" },
  { id: "summary", route: "/inventory?section=sec-orch", method: "readSummary", owner: "#inventory-summary", state: "data-inventory-state", status: "inventory-summary-status", mode: "held" },
  { id: "page", route: "/inventory?section=sec-orch", method: "readPage", owner: "#inventory-page", state: "data-inventory-state", status: "inventory-page-status", mode: "reject" },
  { id: "selection", route: "/inventory?section=sec-orch&unit=sec-orch-s000003", method: "readSelection", owner: "#inventory-selection", state: "data-inventory-state", status: "inventory-selection-status", mode: "throw" },
] as const;

describe("explicit read recovery (synthetic fault build)", () => {
  const suite = useBrowser();
  for (const locale of ["en", "ko"] as const) for (const stage of stages) {
    it(`${locale}: keyboard recovers ${stage.id} without a retry or focus loss`, async () => {
      const raw = await suite.newPage();
      const guard = await keyboardOnly(raw);
      const page = guard.page;
      await page.addInitScript(({ method, mode }) => { window.__kixReadFault = { method, mode, calls: 0 }; }, stage);
      await page.goto(suite.faultOrigin! + stage.route + (stage.route.includes("?") ? "&" : "?") + `lang=${locale}`);
      const owner = page.locator(stage.owner);
      if (stage.mode === "held") {
        await poll(() => page.evaluate(() => typeof window.__kixReadFault?.release), (value) => value === "function", "held summary installed");
        expect(await page.locator("#inventory-page").count()).toBe(0);
        await page.evaluate(() => window.__kixReadFault?.release?.());
      }
      await poll(() => owner.getAttribute(stage.state), (state) => state === "unknown", `${stage.id} unknown`);
      expect(await owner.innerText()).toContain(locale === "en" ? "Unknown read." : "미확인 조회.");
      expect(await owner.innerText()).not.toContain("private payload");
      const calls = await page.evaluate(() => window.__kixReadFault!.calls);
      const selector = `${stage.owner} button`;
      // Only the conditional recovery button has this label; permanent refresh
      // controls keep their separate labels and also stay keyboard reachable.
      const recovery = owner.getByRole("button", { name: locale === "en" ? "Read again" : "다시 조회", exact: true });
      await recovery.waitFor();
      await recovery.evaluate((node) => node.setAttribute("data-read-recovery", "true"));
      expect(await tabTo(page, `${selector}[data-read-recovery]`)).toBe(true);
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.hasAttribute("data-read-recovery"))).toBe(true);
      await page.evaluate(() => { window.__kixReadFault!.mode = "normal"; });
      await page.keyboard.press(locale === "en" ? "Enter" : "Space");
      await poll(() => owner.getAttribute(stage.state), (state) => state === "ready", `${stage.id} recovered`);
      expect(await page.evaluate(() => window.__kixReadFault!.calls)).toBe(calls + 1);
      expect(await page.evaluate(() => document.activeElement?.id)).toBe(stage.status);
      if (stage.id === "list" || stage.id === "page") {
        expect(await tabTo(page, `${stage.owner} [role=listbox]`)).toBe(true);
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await page.locator(stage.id === "list" ? "#discovery-live-detail" : "#inventory-selection").waitFor();
      }
      await guard.assertNoPointer();
      await suite.pass(page, `read-lifecycle.${locale}.${stage.id}`);
      await page.close();
    });
  }

  it("discovery and inventory recovery leave the attach-lost write UNKNOWN and journal fenced", async () => {
    const raw = await suite.newPage();
    const guard = await keyboardOnly(raw);
    const page = guard.page;
    await page.goto(suite.faultOrigin! + "/session?lang=en");
    await page.locator("#session-status").waitFor();
    expect(await tabTo(page, 'select[aria-label="Scenario"]')).toBe(true);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await poll(() => page.locator('select[aria-label="Scenario"]').inputValue(), (value) => value === "attach-lost", "attach-lost scenario");
    expect(await tabTo(page, "#session-attach-obs-0001")).toBe(true);
    await page.keyboard.press("Enter");
    await page.locator('[data-outcome="UNKNOWN"]').first().waitFor();
    const journal = await page.evaluate(() => sessionStorage.getItem("kix-session-journal"));
    expect(journal).toBeTruthy();
    for (const [route, method, owner, attribute] of [
      ["/discovery", "readPage", "#discovery-live", "data-live-state"],
      ["/inventory", "readSummary", "#inventory-summary", "data-inventory-state"],
    ] as const) {
      await page.evaluate((method) => { window.__kixReadFault = { method, mode: "reject", calls: 0 }; }, method);
      expect(await tabTo(page, `a[href='${route}']`)).toBe(true);
      await page.keyboard.press("Enter");
      await poll(() => page.locator(owner).getAttribute(attribute), (state) => state === "unknown", "read unknown");
      const button = page.locator(owner).getByRole("button", { name: "Read again", exact: true });
      await button.evaluate((node) => node.setAttribute("data-read-recovery", "true"));
      expect(await tabTo(page, `${owner} [data-read-recovery]`)).toBe(true);
      await page.evaluate(() => { window.__kixReadFault!.mode = "normal"; });
      await page.keyboard.press("Enter");
      await poll(() => page.locator(owner).getAttribute(attribute), (state) => state === "ready", "read recovered");
      expect(await page.evaluate(() => sessionStorage.getItem("kix-session-journal"))).toBe(journal);
    }
    expect(await tabTo(page, "a[href='/session']")).toBe(true);
    await page.keyboard.press("Enter");
    await page.locator('[data-outcome="UNKNOWN"]').first().waitFor();
    expect(await page.locator("#session-attach-obs-0001").isDisabled()).toBe(true);
    expect(await page.locator("body").innerText()).toContain("Sent 1 in this load.");
    expect(await page.evaluate(() => sessionStorage.getItem("kix-session-journal"))).toBe(journal);
    await guard.assertNoPointer();
    await suite.pass(page, "read-lifecycle.write-UNKNOWN-isolation");
    await page.close();
  });
});
