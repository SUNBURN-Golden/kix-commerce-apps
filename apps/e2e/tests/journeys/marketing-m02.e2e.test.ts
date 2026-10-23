import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav, press } from "../../src/desk";
import { useBrowser } from "../../src/suite";
describe("marketing-m02 journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Marketing");
        await page.locator('a.hub-card[href="/marketing/m02"]').click();
        await page.locator(".program button").first().waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator('main a[href="/marketing/m01"]').first().click();
        await page.locator("#membership-name").fill("Browser member");
        await page.locator("#membership-form select").selectOption("member");
        await press(page, "Issue demo card");
        await page.locator('main a[href="/marketing/m02"]').first().click();
        await page.getByRole("button", { name: "Record demo interest" }).first().click();
        await expectText(page, "Recorded");
        expect(await page.locator(".program li").first().getByRole("button").isDisabled()).toBe(true);
        await suite.pass(page, "marketing-m02.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        expect(await page.locator(".program li").first().getByRole("button").isDisabled()).toBe(true);
        await expectText(page, "closed-demo");
        await suite.pass(page, "marketing-m02.REJECT");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await expectText(page, "no-published-command");
        await expectText(page, "No live chain, no funds, and no outbound message.");
        await expectNoButton(page, BANNED_SEND);
        await expectNoButton(page, /^Send /);
        await suite.pass(page, "marketing-m02.NOT_BOUND");
        await page.close();
    });
});
