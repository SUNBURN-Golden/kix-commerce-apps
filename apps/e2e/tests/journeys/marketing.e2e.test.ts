import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav, press } from "../../src/desk";
import { useBrowser } from "../../src/suite";
describe("marketing journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Marketing");
        await page.locator(".hub").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        expect(await page.locator("a.hub-card").count()).toBe(5);
        await page.locator('a.hub-card[href="/marketing/m01"]').click();
        await page.locator("#membership-name").waitFor();
        await page.locator('main a[href="/marketing"]').first().click();
        await page.getByRole("button", { name: "Reset marketing session" }).waitFor();
        await suite.pass(page, "marketing.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await press(page, "Reset marketing session");
        await expectText(page, "guest");
        await expectText(page, "unset");
        await suite.pass(page, "marketing.REJECT");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await expectText(page, "no-published-command");
        await expectText(page, "No live chain, no funds, and no outbound message.");
        await expectNoButton(page, BANNED_SEND);
        await suite.pass(page, "marketing.NOT_BOUND");
        await page.close();
    });
});
