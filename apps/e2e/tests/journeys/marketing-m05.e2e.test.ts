import { describe, expect, it } from "vitest";
import { BANNED_SEND, expectNoButton, expectText, newDeskPage, nav, poll, press } from "../../src/desk";
import { oneAttempt } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("marketing-m05 journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Marketing");
        await page.locator('a.hub-card[href="/marketing/m05"]').click();
        await page.locator("#consent-event").first().waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#performance-notes").check();
        await press(page, "Save consent flags");
        for (const [id, value] of [["event", "evt_browser_consent"], ["subject", "subject-fixture"], ["business", "business-fixture"], ["channel", "fixture-channel"], ["purpose", "fixture-purpose"], ["version", "1"]]) {
            await page.locator("#consent-" + id).fill(value);
        }
        await page.locator("#consent-allowed").selectOption("true");
        await press(page, "Send set_consent");
        await page.locator('li.journey-step[data-status="confirmed"]').waitFor();
        await press(page, "Send authorize_marketing");
        expect(await page.locator('li.journey-step[data-status="confirmed"]').count()).toBe(2);
        await suite.pass(page, "marketing-m05.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#consent-event").fill("evt_incomplete");
        await press(page, "Send set_consent");
        await page.locator(".error-summary").waitFor();
        expect(await page.locator('li.journey-step[data-status="confirmed"]').count()).toBe(0);
        await suite.pass(page, "marketing-m05.REJECT");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await expectText(page, "channelSend: none.");
        await expectText(page, "No live chain, no funds, and no outbound message.");
        await expectNoButton(page, BANNED_SEND);
        await suite.pass(page, "marketing-m05.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        for (const [id, value] of [["event", "evt_browser_consent"], ["subject", "subject-fixture"], ["business", "business-fixture"], ["channel", "fixture-channel"], ["purpose", "fixture-purpose"], ["version", "1"]]) {
            await page.locator("#consent-" + id).fill(value);
        }
        await page.locator("#consent-allowed").selectOption("true");
        await press(page, "Send set_consent");
        await oneAttempt(page, suite, page.getByRole("button", { name: "Send authorize_marketing", exact: true }), async () => {
            await poll(() => page.locator('li.journey-step[data-status="confirmed"]').count(), n => n === 2, "one consent and authorization");
            expect(await page.getByText("cns:evt_browser_consent:1:authorize_marketing", { exact: true }).count()).toBe(1);
        }, async () => {
            await page.locator("#consent-event").waitFor();
            expect(await page.locator('li.journey-step[data-status="confirmed"]').count()).toBe(0);
        });
        await suite.pass(page, "marketing-m05.one-attempt");
        await page.close();
    });
});
