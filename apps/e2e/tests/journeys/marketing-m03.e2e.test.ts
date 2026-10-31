import { describe, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav, press } from "../../src/desk";
import { useBrowser } from "../../src/suite";
describe("marketing-m03 journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Marketing");
        await page.locator('a.hub-card[href="/marketing/m03"]').click();
        await page.locator("#coupon-code").first().waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#coupon-code").fill("LANTERN-NOTE");
        await press(page, "Apply demo code");
        await expectText(page, "Attached");
        await suite.pass(page, "marketing-m03.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#coupon-code").fill("NOT-A-FIXTURE");
        await press(page, "Apply demo code");
        await page.getByRole("alert").waitFor();
        for (const code of ["DEMO-EXPIRED", "DEMO-FUTURE", "DEMO-UNKNOWN", "DEMO-GROUP-A", "DEMO-GROUP-B"]) {
            await page.locator("#coupon-code").fill(code);
            await press(page, "Apply demo code");
        }
        await expectText(page, "Synthetic fixture group conflict");
        await suite.pass(page, "marketing-m03.REJECT");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await expectText(page, "no-published-command");
        await expectText(page, "No live chain, no funds, and no outbound message.");
        await expectNoButton(page, BANNED_SEND);
        await expectNoButton(page, /^Send /);
        await suite.pass(page, "marketing-m03.NOT_BOUND");
        await page.close();
    });
});
