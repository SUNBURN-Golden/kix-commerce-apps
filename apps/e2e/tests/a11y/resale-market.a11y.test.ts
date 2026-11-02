import { describe, expect, it } from "vitest";
import { useBrowser } from "../../src/suite";
import { engineComposition, confirmation } from "../../src/composition";
import { overflowProblems } from "../../src/a11y-keyboard";
import { openScreen } from "./helpers";

describe("resale market bilingual form and display", () => {
  const suite = useBrowser();
  it("keeps IME confirmation in edit, focuses invalid summary and records only after explicit review", async () => {
    const page = await suite.newPage();
    await openScreen(page,suite.origin,"/resale/market/demo-001?lang=ko");
    await page.getByLabel("거래 방식",{ exact: true }).selectOption("bid");
    await page.locator("#market-units").fill("");
    await engineComposition(page,"#market-units",false,async () => {
      await page.locator("#market-trade-form").evaluate(el => (el as HTMLFormElement).requestSubmit());
      expect(await page.getByRole("heading",{ name: "모의 거래 검토" }).count()).toBe(0);
    });
    await confirmation(page,"#market-units","key-first");
    expect(await page.getByRole("heading",{ name: "모의 거래 검토" }).count()).toBe(0);
    await page.locator("#market-units").fill("01");
    // End the browser's preedit turn explicitly before the separate deliberate submit.
    await page.locator("#market-units").blur();
    expect(await page.locator("#market-units").getAttribute("aria-invalid")).toBe("true");
    expect(await page.locator(".error-summary:focus").count()).toBe(0);
    await page.getByRole("button",{ name: "모의 거래 검토" }).click();
    await page.locator(".error-summary:focus").waitFor();
    expect(await page.locator(".error-summary:focus").count()).toBe(1);
    await page.locator("#market-units").fill("117"); await page.getByRole("button",{ name: "모의 거래 검토" }).click();
    await page.getByRole("heading",{ name: "모의 거래 검토" }).waitFor();
    await page.locator('[data-locale="en"]').click();
    await page.getByRole("heading",{ name: "Review simulation" }).waitFor();
    await page.getByRole("button",{ name: "Record simulation once" }).click();
    await page.locator('[data-market-outcome="CONFIRMED"]').waitFor();
    expect(await page.getByText("117 mock units",{ exact: false }).count()).toBeGreaterThan(0);
    await suite.pass(page,"a11y.resale-market.ime"); await page.close();
  });
  it.each(["dark","forced-colors"] as const)("keeps localized chart and history readable under %s at 320px", async scheme => {
    const page = await suite.newPage();
    await page.emulateMedia(scheme === "dark" ? { colorScheme: "dark" } : { forcedColors: "active" });
    await openScreen(page,suite.origin,"/resale/market/demo-001?lang=ko","narrow");
    await page.getByRole("heading",{ name: "체결 내역" }).waitFor();
    expect(await overflowProblems(page,"resale.reflow")).toEqual([]);
    if (scheme === "forced-colors") {
      const colors = await page.getByRole("button",{ name: "모의 거래 검토" }).evaluate(el => ({ text: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor, bodyText: getComputedStyle(document.body).color }));
      expect(colors.text).toBe(colors.bodyText);
      expect(colors.text).not.toBe(colors.background);
    }
    expect(await page.getByRole("img",{ name: "fixture 가격 추이" }).count()).toBe(1);
    await suite.pass(page,`a11y.resale-market.${scheme}`); await page.close();
  });
});
