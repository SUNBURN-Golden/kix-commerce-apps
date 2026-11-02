import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav, press } from "../../src/desk";
import { useBrowser } from "../../src/suite";
describe("marketing-m04 journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Marketing");
        await page.locator('a.hub-card[href="/marketing/m04"]').click();
        await page.locator("#referral-code").first().waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#referral-code").fill("REF-STUB-HALL");
        await press(page, "Count demo marker");
        await expectText(page, "REF-STUB-HALL");
        expect(await page.locator("main article.ticket dd").first().innerText()).toBe("1");
        expect(await page.locator("main p.empty").count()).toBe(0);
        await expectText(page, "synthetic:REF-STUB-HALL");
        await page.locator("#referral-code").fill("REF-STUB-PAPER");
        await press(page, "Count demo marker");
        await expectText(page, "synthetic:REF-STUB-PAPER");
        await page.locator("#referral-code").fill("REF-STUB-HALL");
        await press(page, "Count demo marker");
        await expectText(page, "already counted");
        await suite.pass(page, "marketing-m04.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#referral-code").fill("NOT-A-FIXTURE");
        await press(page, "Count demo marker");
        await page.getByRole("alert").waitFor();
        await suite.pass(page, "marketing-m04.REJECT");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await expectText(page, "no-published-command");
        await expectText(page, "No live chain, no funds, and no outbound message.");
        await expectNoButton(page, BANNED_SEND);
        await expectNoButton(page, /^Send /);
        await suite.pass(page, "marketing-m04.NOT_BOUND");
        await page.close();
    });
});
