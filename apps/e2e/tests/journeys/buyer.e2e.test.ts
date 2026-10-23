import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav } from "../../src/desk";
import { attribute } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("buyer journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Buyer");
        await page.locator("#buyer-shows").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.getByRole("button", { name: "North Station Lanterns", exact: true }).click();
        await attribute(page, '#buyer-shows button[aria-pressed="true"]', "aria-pressed", "true");
        await expectText(page, "evt_lanterns");
        expect(await page.locator('#buyer-progress [data-stage]').count()).toBeGreaterThan(0);
        await suite.pass(page, "buyer.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await expectText(page, "No order is selected.");
        expect(await page.locator("#buyer-evidence .empty").count()).toBe(1);
        expect(await page.locator("#buyer-evidence [data-kind]").count()).toBe(0);
        await suite.pass(page, "buyer.REJECT");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator('#buyer-progress [data-state="not-bound"]').first().waitFor();
        await expectText(page, "No write sent by this page.");
        await expectText(page, "reserve_listing");
        await expectNoButton(page, BANNED_SEND);
        await suite.pass(page, "buyer.NOT_BOUND");
        await page.close();
    });
});
