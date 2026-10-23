import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav, press } from "../../src/desk";
import { useBrowser } from "../../src/suite";
describe("marketing-m01 journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Marketing");
        await page.locator('a.hub-card[href="/marketing/m01"]').click();
        await page.locator("#membership-name").first().waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#membership-name").fill("Browser fan");
        await press(page, "Issue demo card");
        await expectText(page, "Browser fan");
        await expectText(page, "session-only");
        await suite.pass(page, "marketing-m01.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await press(page, "Issue demo card");
        await page.locator(".error-summary").waitFor();
        expect(await page.getByRole("button", { name: "Clear demo card" }).isDisabled()).toBe(true);
        await suite.pass(page, "marketing-m01.REJECT");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await expectText(page, "no-published-command");
        await expectText(page, "No live chain, no funds, and no outbound message.");
        await expectNoButton(page, BANNED_SEND);
        await expectNoButton(page, /^Send /);
        await suite.pass(page, "marketing-m01.NOT_BOUND");
        await page.close();
    });
});
