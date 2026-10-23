import { describe, it } from "vitest";
import { expectText, newDeskPage, nav, poll } from "../../src/desk";
import { holdNotice, oneAttempt, selectScenario } from "../../src/synthetic-desk";
import { useBrowser } from "../../src/suite";
describe("provider journey (stub, headless Chrome)", () => {
    const suite = useBrowser();
    async function open() {
        const page = await newDeskPage(suite.newPage, suite.origin);
        page.setDefaultTimeout(15000);
        await nav(page, "Provider journey");
        await page.locator("#provider-scenario").waitFor();
        return page;
    }
    it("SUCCESS: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await page.locator("#provider-begin-ord-0001").click();
        await page.locator("#provider-event-return-ord-0001").click();
        await page.locator("#provider-event-callback-ord-0001").click();
        await page.locator("#provider-observe-ord-0001").click();
        await page.locator("#provider-issue-ord-0001").click();
        await page.locator('[data-outcome="CONFIRMED"]').nth(2).waitFor();
        await expectText(page, "not a real payment");
        await suite.pass(page, "provider.SUCCESS");
        await page.close();
    });
    it("REJECT: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "provider", "declined");
        await page.locator("#provider-begin-ord-0001").click();
        await page.locator("#provider-event-return-ord-0001").click();
        await page.locator("#provider-event-callback-ord-0001").click();
        await page.locator("#provider-observe-ord-0001").click();
        await page.locator('[data-outcome="REJECTED"]').waitFor();
        await expectText(page, "PAYMENT_DECLINED");
        await suite.pass(page, "provider.REJECT");
        await page.close();
    });
    it("UNKNOWN: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "provider", "observe-lost");
        await page.locator("#provider-begin-ord-0001").click();
        await page.locator("#provider-event-return-ord-0001").click();
        await page.locator("#provider-event-callback-ord-0001").click();
        await page.locator("#provider-observe-ord-0001").click();
        await page.locator('[data-outcome="UNKNOWN"]').waitFor();
        await expectText(page, "RESPONSE_LOST");
        await suite.pass(page, "provider.UNKNOWN");
        await page.close();
    });
    it("NOT_BOUND: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await holdNotice(page);
        await suite.pass(page, "provider.NOT_BOUND");
        await page.close();
    });
    it("one-attempt: existing synthetic controls and observed evidence", async () => {
        const page = await open();
        await selectScenario(page, "provider", "begin-lost");
        await oneAttempt(page, suite, page.locator("#provider-begin-ord-0001"), async () => {
            await poll(() => page.locator("#provider-session [data-counters]").innerText(), value => /Sent 1\./.test(value), "exactly one send");
        }, async () => {
            await page.locator("#provider-scenario").waitFor();
            await poll(() => page.locator("#provider-session [data-counters]").innerText(), value => /Sent 0\./.test(value), "no replay after reload");
        });
        await suite.pass(page, "provider.one-attempt");
        await page.close();
    });
});
